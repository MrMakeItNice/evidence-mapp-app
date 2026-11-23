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
// Syntax-only checks: these do not establish reachability, authenticity or document identity.
function urlProblem(value) {
  const raw = cleanUrl(value);
  if (raw === null) return 'missing';
  if (/\s/.test(raw)) return 'malformed';
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname ||
        parsed.username || parsed.password) return 'malformed';
    return null;
  } catch {
    return 'malformed';
  }
}
function urlQuality(rows, field) {
  let missing = 0;
  const malformedIds = [];
  for (const row of rows) {
    const problem = urlProblem(row[field]);
    if (problem === 'missing') missing++;
    if (problem === 'malformed') malformedIds.push(row.id);
  }
  malformedIds.sort((a,b)=>a-b);
  return {
    missing_url: missing,
    malformed_url: malformedIds.length,
    malformed_url_item_ids: malformedIds.slice(0,25),
    omitted_malformed_url_item_ids: Math.max(0, malformedIds.length - 25)
  };
}

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
    // An identical but invalid URL is not evidence of a shared source.
    // Report malformed links separately; do not use them for duplicate/linkage counts.
    if (urlProblem(url) !== null) continue;
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
// Numeric-only exact-URL join candidates for manual source linking; never auto-link records.
function overlapCandidatePairs(left, right, limit = 25) {
  const pairs = [];
  for (const [url, leftIds] of left) {
    const rightIds = right.get(url);
    if (!rightIds) continue;
    for (const leftId of leftIds) for (const rightId of rightIds) pairs.push([leftId, rightId]);
  }
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return {
    id_pairs: pairs.slice(0, limit),
    omitted_id_pairs: Math.max(0, pairs.length - limit)
  };
}

// Review-only metadata differences for exact, syntactically valid news/inbox URLs.
// Publisher label differences may be aliases; timestamps >24h apart warrant source review,
// not an automatic claim that either date is wrong. Never emit URLs or publisher text.
function exactNewsInboxMetadataReview(news, inbox, limit = 25) {
  const indexed = new Map();
  for (const i of inbox) {
    const url = cleanUrl(i.source_url);
    if (urlProblem(url) !== null) continue;
    if (!indexed.has(url)) indexed.set(url, []);
    indexed.get(url).push(i);
  }
  const publisherPairs = [], timestampPairs = [];
  const label = value => typeof value === 'string' ?
    value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
  for (const n of news) {
    const url = cleanUrl(n.source_url);
    if (urlProblem(url) !== null || !indexed.has(url)) continue;
    for (const i of indexed.get(url)) {
      const publisherA = label(n.publisher), publisherB = label(i.publisher);
      if (publisherA && publisherB && publisherA !== publisherB) publisherPairs.push([n.id, i.id]);
      const dateA = timestamp(n.published_at, 'news.published_at');
      const dateB = timestamp(i.published_at, 'inbox.published_at');
      if (dateA !== null && dateB !== null && Math.abs(dateA - dateB) > 86400000)
        timestampPairs.push([n.id, i.id]);
    }
  }
  const summarize = pairs => {
    pairs.sort((a,b) => a[0] - b[0] || a[1] - b[1]);
    return {count: pairs.length, id_pairs: pairs.slice(0, limit),
      omitted_id_pairs: Math.max(0, pairs.length - limit)};
  };
  const publishers = summarize(publisherPairs);
  const dates = summarize(timestampPairs);
  return {
    publisher_label_difference_pairs: publishers.count,
    publisher_label_difference_id_pairs: publishers.id_pairs,
    omitted_publisher_label_difference_id_pairs: publishers.omitted_id_pairs,
    publication_times_over_24h_apart_pairs: dates.count,
    publication_times_over_24h_apart_id_pairs: dates.id_pairs,
    omitted_publication_time_difference_id_pairs: dates.omitted_id_pairs
  };
}

// One-sided date metadata on an exact, valid news/source link is a review lead,
// never proof that either value is correct. Sources store a date (not an instant),
// so deliberately avoid timestamp/date calendar comparisons across these tables.
function exactNewsSourcePublicationDateReview(news, sources, limit = 25) {
  const sourceIndex = new Map();
  for (const source of sources) {
    const url = cleanUrl(source.url);
    if (urlProblem(url) !== null) continue;
    if (!sourceIndex.has(url)) sourceIndex.set(url, []);
    sourceIndex.get(url).push(source);
  }
  const newsMissing = [], sourceMissing = [];
  for (const item of news) {
    const url = cleanUrl(item.source_url);
    if (urlProblem(url) !== null) continue;
    for (const source of sourceIndex.get(url) ?? []) {
      if (absent(item.published_at) && !absent(source.publication_date)) {
        newsMissing.push([item.id, source.id]);
      } else if (!absent(item.published_at) && absent(source.publication_date)) {
        sourceMissing.push([item.id, source.id]);
      }
    }
  }
  const summarize = pairs => {
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return { count: pairs.length, id_pairs: pairs.slice(0, limit),
      omitted_id_pairs: Math.max(0, pairs.length - limit) };
  };
  return {
    news_missing_source_dated: summarize(newsMissing),
    source_missing_news_dated: summarize(sourceMissing)
  };
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
  const newsUrlQuality = urlQuality(news, 'source_url');
  const inboxUrlQuality = urlQuality(inbox, 'source_url');
  const publishedSources = sources.filter(s=>s.published === true);
  const sourceUrlQuality = urlQuality(publishedSources, 'url');
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
  // Some imported inbox records may have an added_at but no discovered_at.
  // Use the explicit discovery timestamp when available, otherwise fall back to
  // the ingestion date. Report records with neither rather than silently treating
  // them as fresh; this is triage metadata, not proof of source publication age.
  const oldPendingInboxIds = [];
  const fallbackInboxAgeIds = [];
  const unknownInboxAgeIds = [];
  for (const item of inbox) {
    if (item.review_status !== 'pending') continue;
    const discovered = timestamp(item.discovered_at, 'inbox.discovered_at');
    const added = timestamp(item.added_at, 'inbox.added_at');
    if (discovered === null && added !== null) fallbackInboxAgeIds.push(item.id);
    const firstSeen = discovered ?? added;
    if (firstSeen === null) unknownInboxAgeIds.push(item.id);
    else if (firstSeen < asOf - 14 * 86400000) oldPendingInboxIds.push(item.id);
  }
  oldPendingInboxIds.sort((a,b)=>a-b);
  fallbackInboxAgeIds.sort((a,b)=>a-b);
  unknownInboxAgeIds.sort((a,b)=>a-b);
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
  // A feed can have a recent successful poll yet still be failing on its latest attempt.
  // Keep these states distinct: stale watches alone do not prove a collection outage.
  const latestErrorRecentSuccessIds = [];
  const latestErrorWithoutRecentSuccessIds = [];
  for (const feed of activeFeeds) {
    const status = String(feed.last_run_status ?? '').trim().toLowerCase();
    if (!['error', 'failed', 'failure'].includes(status)) continue;
    const success = timestamp(feed.last_success_at, 'feed.last_success_at');
    const recent = success !== null && success >= asOf - 86400000 && success <= asOf;
    (recent ? latestErrorRecentSuccessIds : latestErrorWithoutRecentSuccessIds).push(feed.feed_id);
  }
  latestErrorRecentSuccessIds.sort((a,b) => a-b);
  latestErrorWithoutRecentSuccessIds.sort((a,b) => a-b);
  flaggedFutureNewsIds.sort((a,b) => a-b);
  undatedNonGoogleIds.sort((a,b) => a-b);
  const emptyActiveTopicIds = activeTopics.filter(t => !topicWithItem.has(t.id)).map(t => t.id).sort((a,b) => a-b);
  const newsInboxCandidates = overlapCandidatePairs(newsUrls, inboxUrls);
  const newsSourceCandidates = overlapCandidatePairs(newsUrls, sourceUrls);
  const inboxSourceCandidates = overlapCandidatePairs(inboxUrls, sourceUrls);
  const metadataReview = exactNewsInboxMetadataReview(news, inbox);
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
      ...newsUrlQuality,
      exact_url_duplicate_groups: repeatedGroups(newsUrls),
      active_topics: activeTopics.length,
      active_topics_without_direct_items: emptyActiveTopicIds.length,
      empty_active_topic_ids: emptyActiveTopicIds.slice(0,25)
    },
    inbox: {
      total: inbox.length,
      pending: inbox.filter(i => i.review_status === 'pending').length,
      pending_over_14d: oldPendingInboxIds.length,
      old_pending_item_ids: oldPendingInboxIds.slice(0,25),
      omitted_old_pending_item_ids: Math.max(0, oldPendingInboxIds.length - 25),
      pending_aged_by_added_at_fallback: fallbackInboxAgeIds.length,
      fallback_age_item_ids: fallbackInboxAgeIds.slice(0,25),
      omitted_fallback_age_item_ids: Math.max(0, fallbackInboxAgeIds.length - 25),
      pending_without_any_discovery_or_added_date: unknownInboxAgeIds.length,
      unknown_age_item_ids: unknownInboxAgeIds.slice(0,25),
      omitted_unknown_age_item_ids: Math.max(0, unknownInboxAgeIds.length - 25),
      ...inboxUrlQuality,
      missing_publication_timestamp: inbox.filter(i => absent(i.published_at)).length,
      without_watch_topic: inbox.filter(i => i.watch_topic_id == null).length,
      without_related_case: inbox.filter(i => i.related_case_id == null).length,
      exact_url_duplicate_groups: repeatedGroups(inboxUrls)
    },
    sources: {
      total: sources.length,
      published_marked: sources.filter(s => s.published === true).length,
      ...sourceUrlQuality,
      published_marked_missing_date: sources.filter(s => s.published === true && absent(s.publication_date)).length,
      published_marked_missing_publisher: sources.filter(s => s.published === true && absent(s.publisher)).length,
      exact_url_duplicate_groups: repeatedGroups(sourceUrls)
    },
    overlap: {
      news_inbox_exact_url_rows: overlapCount(newsUrls, inboxUrls),
      news_source_exact_url_rows: overlapCount(newsUrls, sourceUrls),
      news_inbox_exact_url_id_pairs: newsInboxCandidates.id_pairs,
      news_inbox_omitted_id_pairs: newsInboxCandidates.omitted_id_pairs,
      news_source_exact_url_id_pairs: newsSourceCandidates.id_pairs,
      news_source_omitted_id_pairs: newsSourceCandidates.omitted_id_pairs,
      inbox_source_exact_url_rows: overlapCount(inboxUrls, sourceUrls),
      inbox_source_exact_url_id_pairs: inboxSourceCandidates.id_pairs,
      inbox_source_omitted_id_pairs: inboxSourceCandidates.omitted_id_pairs,
      news_inbox_metadata_review: metadataReview,
      news_source_publication_date_review: exactNewsSourcePublicationDateReview(news, sources)
    },
    watches: {
      active_research: researchWatches.filter(w=>w.active === true).length,
      stale_research_timestamp_fields: stale(researchWatches, 'last_checked_at'),
      active_news: newsWatches.filter(w=>w.active === true).length,
      stale_news_timestamp_fields: stale(newsWatches, 'last_collected_at'),
      active_collectors: activeFeeds.length,
      collectors_without_success_in_24h: feedLastSuccessUnknownOrOld,
      collectors_latest_error_with_recent_success: latestErrorRecentSuccessIds.length,
      collectors_latest_error_without_recent_success: latestErrorWithoutRecentSuccessIds.length,
      latest_error_recent_success_feed_ids: latestErrorRecentSuccessIds.slice(0,25),
      latest_error_without_recent_success_feed_ids: latestErrorWithoutRecentSuccessIds.slice(0,25)
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
