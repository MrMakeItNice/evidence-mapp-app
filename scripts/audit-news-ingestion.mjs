// Read-only, offline Evidence Atlas ingestion audit. Never commit private snapshots.
// Usage: node scripts/audit-news-ingestion.mjs path/to/complete-snapshot.json
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const required = ['news_items', 'research_inbox', 'sources', 'news_topics',
  'research_watch_topics', 'news_watch_topics', 'agent_control_feeds'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const absent = value => value == null || (typeof value === 'string' && !value.trim());
const cleanUrl = value => typeof value === 'string' && value.trim() ? value.trim() : null;

function timestamp(value, field) {
  if (absent(value)) return null;
  if (typeof value !== 'string' ||
      !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(value)) {
    throw new Error('Invalid timestamp in ' + field);
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) throw new Error('Invalid timestamp in ' + field);
  return date;
}
function collectUrls(rows, field) {
  const found = new Map();
  for (const row of rows) {
    const url = cleanUrl(row[field]);
    if (!url) continue;
    // Conservative identity: never strip query strings, which may select distinct documents.
    if (!found.has(url)) found.set(url, []);
    found.get(url).push(row.id);
  }
  return found;
}
function repeatedGroups(map) {
  return [...map.values()].filter(ids => ids.length > 1).length;
}
function overlapCount(a, b) {
  let total = 0;
  for (const [url, ids] of a) if (b.has(url)) total += ids.length * b.get(url).length;
  return total;
}
function checkCollection(snapshot, name, idField = 'id') {
  const rows = snapshot[name];
  if (!Array.isArray(rows) || !Number.isSafeInteger(snapshot.expected_counts[name]) ||
      snapshot.expected_counts[name] < 0 || rows.length !== snapshot.expected_counts[name]) {
    throw new Error('Incomplete ' + name + ' snapshot');
  }
  const ids = new Set();
  for (const row of rows) {
    if (!isObject(row) || !positiveId(row[idField]) || ids.has(row[idField])) {
      throw new Error('Invalid ' + name + ' ID');
    }
    ids.add(row[idField]);
  }
  return rows;
}

export function auditNewsIngestion(snapshot) {
  if (!isObject(snapshot) || !isObject(snapshot.expected_counts)) throw new Error('Invalid snapshot');
  const asOf = timestamp(snapshot.as_of, 'as_of');
  if (asOf === null) throw new Error('Missing as_of');
  const collections = {};
  for (const name of required) collections[name] = checkCollection(snapshot, name, name === 'agent_control_feeds' ? 'feed_id' : 'id');
  const {news_items: news, research_inbox: inbox, sources,
    news_topics: topics, research_watch_topics: researchWatches,
    news_watch_topics: newsWatches, agent_control_feeds: feeds} = collections;
  const newsUrls = collectUrls(news, 'source_url');
  const inboxUrls = collectUrls(inbox, 'source_url');
  const sourceUrls = collectUrls(sources, 'url');
  const newsTopicIds = new Set(topics.map(row => row.id));
  const flaggedFutureNewsIds = [];
  const undatedNonGoogleIds = [];
  let discovered24h = 0, pending14d = 0, undatedGoogle = 0, undated = 0;
  for (const n of news) {
    if (n.topic_id != null && !newsTopicIds.has(n.topic_id)) throw new Error('Unknown news topic');
    const published = timestamp(n.published_at, 'news.published_at');
    const discovered = timestamp(n.discovered_at, 'news.discovered_at');
    if (published === null) {
      undated++;
      const googleProxy = String(n.publisher || '').toLowerCase().includes('google') ||
        String(n.source_url || '').toLowerCase().includes('news.google.com');
      if (googleProxy) undatedGoogle++;
      else undatedNonGoogleIds.push(n.id);
    }
    if (published !== null && published > asOf) flaggedFutureNewsIds.push(n.id);
    if (discovered !== null && discovered <= asOf && discovered >= asOf - 86400000) discovered24h++;
    if (n.review_status === 'pending' && discovered !== null && discovered < asOf - 14 * 86400000) pending14d++;
  }
  const activeTopics = topics.filter(t => t.active === true);
  const researchWatchIds = new Set(researchWatches.map(w => w.id));
  for (const item of inbox) {
    if (item.watch_topic_id != null && !researchWatchIds.has(item.watch_topic_id)) {
      throw new Error('Unknown inbox watch topic');
    }
  }
  const topicWithItem = new Set(news.map(n => n.topic_id).filter(x => x != null));
  function stale(watches, column) {
    return watches.filter(w => {
      if (w.active !== true) return false;
      const seen = timestamp(w[column], column);
      return seen === null || seen < asOf - 86400000;
    }).length;
  }
  const activeFeeds = feeds.filter(f => f.active === true);
  const feedLastSuccessUnknownOrOld = activeFeeds.filter(f => {
    const date = timestamp(f.last_success_at, 'feed.last_success_at');
    return date === null || date < asOf - 86400000;
  }).length;
  flaggedFutureNewsIds.sort((a,b) => a-b);
  undatedNonGoogleIds.sort((a,b) => a-b);
  const emptyActiveTopicIds = activeTopics.filter(t => !topicWithItem.has(t.id)).map(t => t.id).sort((a,b) => a-b);
  return {
    as_of: new Date(asOf).toISOString(),
    news: {
      total: news.length,
      pending: news.filter(n => n.review_status === 'pending').length,
      discovered_last_24h: discovered24h,
      pending_over_14d: pending14d,
      missing_publication_timestamp: undated,
      missing_publication_timestamp_google_proxies: undatedGoogle,
      missing_publication_timestamp_other: undatedNonGoogleIds.length,
      undated_other_item_ids: undatedNonGoogleIds.slice(0,25),
      omitted_undated_other_item_ids: Math.max(0, undatedNonGoogleIds.length - 25),
      publication_timestamps_after_snapshot_time: flaggedFutureNewsIds.length,
      future_published_item_ids: flaggedFutureNewsIds.slice(0,20),
      omitted_future_published_item_ids: Math.max(0, flaggedFutureNewsIds.length - 20),
      exact_url_duplicate_groups: repeatedGroups(newsUrls),
      active_topics: activeTopics.length,
      active_topics_without_direct_items: emptyActiveTopicIds.length,
      empty_active_topic_ids: emptyActiveTopicIds.slice(0,25)
    },
    inbox: {
      total: inbox.length,
      pending: inbox.filter(i => i.review_status === 'pending').length,
      missing_publication_timestamp: inbox.filter(i => absent(i.published_at)).length,
      without_watch_topic: inbox.filter(i => i.watch_topic_id == null).length,
      without_related_case: inbox.filter(i => i.related_case_id == null).length,
      exact_url_duplicate_groups: repeatedGroups(inboxUrls)
    },
    sources: {
      total: sources.length,
      published_marked: sources.filter(s => s.published === true).length,
      published_marked_missing_date: sources.filter(s => s.published === true && absent(s.publication_date)).length,
      published_marked_missing_publisher: sources.filter(s => s.published === true && absent(s.publisher)).length,
      exact_url_duplicate_groups: repeatedGroups(sourceUrls)
    },
    overlap: {
      news_inbox_exact_url_rows: overlapCount(newsUrls, inboxUrls),
      news_source_exact_url_rows: overlapCount(newsUrls, sourceUrls)
    },
    watches: {
      active_research: researchWatches.filter(w=>w.active === true).length,
      stale_research_timestamp_fields: stale(researchWatches, 'last_checked_at'),
      active_news: newsWatches.filter(w=>w.active === true).length,
      stale_news_timestamp_fields: stale(newsWatches, 'last_collected_at'),
      active_collectors: activeFeeds.length,
      collectors_without_success_in_24h: feedLastSuccessUnknownOrOld
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    console.error('Usage: node scripts/audit-news-ingestion.mjs complete-local-snapshot.json');
    process.exitCode = 2;
  } else {
    try {
      const snapshot = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
      console.log(JSON.stringify(auditNewsIngestion(snapshot), null, 2));
    } catch (err) {
      console.error('Audit failed: ' + err.message);
      process.exitCode = 1;
    }
  }
}
