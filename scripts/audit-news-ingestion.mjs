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
  // WHATWG URL parsing can silently repair missing slashes and backslashes.
  // Require an explicit authority and reject malformed escapes before parsing.
  if (/\s|[\x00-\x1f\x7f\\]/.test(raw) ||
      !/^https?:\/\/[^/?#]+/i.test(raw) ||
      /%(?![0-9a-f]{2})/i.test(raw)) return 'malformed';
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
// Sources store a calendar date, unlike article/inbox timestamps (exact instants).
// Compare to the UTC calendar day of the snapshot to avoid local-time ambiguity.
// Future-dated records require editorial review, not automatic correction.
function publicationDateOnly(value) {
  if (absent(value)) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invalid sources.publication_date');
  }
  const utcDate = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(utcDate.getTime()) || utcDate.toISOString().slice(0,10) !== value) {
    throw new Error('Invalid sources.publication_date');
  }
  return value;
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
  for (const [url, ids] of a) {
    if (!b.has(url)) continue;
    total += ids.length * b.get(url).length;
    if (!Number.isSafeInteger(total)) throw new Error('Unsafe overlap count');
  }
  return total;
}
// Numeric-only exact-URL join candidates for manual source linking; never auto-link records.
// Sort each matching left ID once; materialize only the requested prefix of the join.
function overlapCandidatePairs(left, right, limit = 25) {
  const total = overlapCount(left, right);
  const pairs = [];
  const matchedLeft = [];
  const sortedRight = new Map();
  for (const [url, leftIds] of left) {
    if (!right.has(url)) continue;
    for (const leftId of leftIds) matchedLeft.push([leftId, url]);
  }
  matchedLeft.sort((a, b) => a[0] - b[0]);
  for (const [leftId, url] of matchedLeft) {
    if (pairs.length >= limit) break;
    if (!sortedRight.has(url)) sortedRight.set(url, [...right.get(url)].sort((a, b) => a - b));
    for (const rightId of sortedRight.get(url)) {
      if (pairs.length >= limit) break;
      pairs.push([leftId, rightId]);
    }
  }
  return {
    id_pairs: pairs,
    omitted_id_pairs: total - pairs.length
  };
}

// Review-only metadata differences for exact, syntactically valid news/inbox URLs.
// Publisher label differences may be aliases; timestamps >24h apart warrant source review,
// not an automatic claim that either date is wrong. Never emit URLs or publisher text.
function exactNewsInboxMetadataReview(news, inbox, limit = 25) {
  const indexed = new Map();
  const label = value => typeof value === 'string' ?
    value.trim().replace(/\s+/g, ' ').toLowerCase() : '';
  for (const i of inbox) {
    const url = cleanUrl(i.source_url);
    if (urlProblem(url) !== null) continue;
    if (!indexed.has(url)) indexed.set(url, []);
    indexed.get(url).push(i);
  }
  for (const [url, rows] of indexed) {
    indexed.set(url, rows.sort((a,b) => a.id-b.id).map(i => ({
      id: i.id, publisher: label(i.publisher),
      date: timestamp(i.published_at, 'inbox.published_at')
    })));
  }
  const bucket = () => ({count: 0, id_pairs: []});
  const publisherPairs = bucket(), timestampPairs = bucket();
  const newsMissingDatePairs = bucket(), inboxMissingDatePairs = bucket();
  const record = (target, a, b) => {
    target.count++;
    if (!Number.isSafeInteger(target.count)) throw new Error('Unsafe metadata pair count');
    if (target.id_pairs.length < limit) target.id_pairs.push([a,b]);
  };
  // Sorted input gives a deterministic review prefix without materializing
  // all discrepancy pairs. Exact counts still inspect each matching pair.
  for (const n of [...news].sort((a,b) => a.id-b.id)) {
    const url = cleanUrl(n.source_url);
    if (urlProblem(url) !== null || !indexed.has(url)) continue;
    const publisherA = label(n.publisher);
    const dateA = timestamp(n.published_at, 'news.published_at');
    for (const i of indexed.get(url)) {
      if (publisherA && i.publisher && publisherA !== i.publisher) record(publisherPairs,n.id,i.id);
      const dateB = i.date;
      if (dateA === null && dateB !== null) record(newsMissingDatePairs,n.id,i.id);
      if (dateA !== null && dateB === null) record(inboxMissingDatePairs,n.id,i.id);
      if (dateA !== null && dateB !== null && Math.abs(dateA - dateB) > 86400000)
        record(timestampPairs,n.id,i.id);
    }
  }
  const summarize = target => ({...target,
    omitted_id_pairs: target.count - target.id_pairs.length});
  const publishers = summarize(publisherPairs);
  const dates = summarize(timestampPairs);
  const missingNewsDates = summarize(newsMissingDatePairs);
  const missingInboxDates = summarize(inboxMissingDatePairs);
  return {
    publisher_label_difference_pairs: publishers.count,
    publisher_label_difference_id_pairs: publishers.id_pairs,
    omitted_publisher_label_difference_id_pairs: publishers.omitted_id_pairs,
    publication_times_over_24h_apart_pairs: dates.count,
    publication_times_over_24h_apart_id_pairs: dates.id_pairs,
    omitted_publication_time_difference_id_pairs: dates.omitted_id_pairs,
    // A date on only one side is a reconciliation lead, never permission to copy it.
    news_missing_inbox_dated_pairs: missingNewsDates.count,
    news_missing_inbox_dated_id_pairs: missingNewsDates.id_pairs,
    omitted_news_missing_inbox_dated_id_pairs: missingNewsDates.omitted_id_pairs,
    inbox_missing_news_dated_pairs: missingInboxDates.count,
    inbox_missing_news_dated_id_pairs: missingInboxDates.id_pairs,
    omitted_inbox_missing_news_dated_id_pairs: missingInboxDates.omitted_id_pairs
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
    if (!sourceIndex.has(url)) sourceIndex.set(url, {missing: [], dated: []});
    sourceIndex.get(url)[absent(source.publication_date) ? 'missing' : 'dated'].push(source.id);
  }
  for (const group of sourceIndex.values()) {
    group.missing.sort((a,b) => a-b);
    group.dated.sort((a,b) => a-b);
  }
  const newsMissing = {count: 0, id_pairs: []}, sourceMissing = {count: 0, id_pairs: []};
  // Numeric IDs are validated by checkCollection. Count matching buckets
  // without enumerating every pair; only materialize the sorted review prefix.
  for (const item of [...news].sort((a,b) => a.id-b.id)) {
    const url = cleanUrl(item.source_url);
    if (urlProblem(url) !== null) continue;
    const group = sourceIndex.get(url);
    if (!group) continue;
    const missing = absent(item.published_at);
    const ids = missing ? group.dated : group.missing;
    const target = missing ? newsMissing : sourceMissing;
    target.count += ids.length;
    if (!Number.isSafeInteger(target.count)) throw new Error('Unsafe metadata pair count');
    for (let i=0; i<ids.length && target.id_pairs.length<limit; i++) {
      target.id_pairs.push([item.id, ids[i]]);
    }
  }
  const summarize = target => ({...target,
    omitted_id_pairs: target.count - target.id_pairs.length});
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
  // Review-only provenance triage: expose numeric source IDs, never titles/URLs.
  // A missing field is not proof the underlying document is inauthentic.
  const missingPublishedSourceIds = predicate => publishedSources
    .filter(predicate).map(s => s.id).sort((a,b) => a-b);
  const sourceDateGapIds = missingPublishedSourceIds(s => absent(s.publication_date));
  const sourcePublisherGapIds = missingPublishedSourceIds(s => absent(s.publisher));
  const sourceUrlGapIds = missingPublishedSourceIds(s => absent(s.url));
  const futureSourcePublicationIds = [];
  const asOfUtcDay = new Date(asOf).toISOString().slice(0,10);
  for (const source of sources) {
    const sourceDay = publicationDateOnly(source.publication_date);
    if (sourceDay !== null && sourceDay > asOfUtcDay) {
      futureSourcePublicationIds.push(source.id);
    }
  }
  futureSourcePublicationIds.sort((a,b)=>a-b);
  // A valid archive-only locator is different from a source with no usable locator.
  // These are syntax checks only: neither URL is assumed reachable or authentic.
  const archiveOnlySourceIds = missingPublishedSourceIds(s =>
    urlProblem(s.url) !== null && urlProblem(s.archive_url) === null);
  const noValidLocatorSourceIds = missingPublishedSourceIds(s =>
    urlProblem(s.url) !== null && Object.hasOwn(s, 'archive_url') &&
    urlProblem(s.archive_url) !== null);
  // Missing column in a projected snapshot is *unknown*, not a missing archive.
  const unknownArchiveFieldSourceIds = missingPublishedSourceIds(s =>
    urlProblem(s.url) !== null && !Object.hasOwn(s, 'archive_url'));
  const malformedArchiveSourceIds = missingPublishedSourceIds(s =>
    urlProblem(s.archive_url) === 'malformed');
  const newsTopicIds = new Set(topics.map(row => row.id));
  const flaggedFutureNewsIds = [];
  const undatedNonGoogleIds = [];
  const unknownPendingNewsDiscoveryIds = [];
  const futureNewsDiscoveryIds = [];
  const newsPublicationAfterDiscoveryIds = [];
  let discovered24h = 0, pending14d = 0, undatedGoogle = 0, undated = 0;
  const agedPendingNewsByTopic = new Map();
  const recentNewsByTopic = new Map();
  let recentUndated = 0, recentUnassigned = 0, recentUnassignedUndated = 0;
  for (const n of news) {
    if (n.topic_id != null && !newsTopicIds.has(n.topic_id)) throw new Error('Unknown news topic');
    const published = timestamp(n.published_at, 'news.published_at');
    const discovered = timestamp(n.discovered_at, 'news.discovered_at');
    // Do not silently classify missing intake timestamps as recent or old.
    if (discovered === null && n.review_status === 'pending') unknownPendingNewsDiscoveryIds.push(n.id);
    if (discovered !== null && discovered > asOf) futureNewsDiscoveryIds.push(n.id);
    // Allow up to one day of metadata skew; this is a review signal, not an error verdict.
    if (published !== null && discovered !== null && published - discovered > 86400000) newsPublicationAfterDiscoveryIds.push(n.id);
    if (published === null) {
      undated++;
      // A publisher label or URL substring is not proof of proxy provenance.
      const googleProxy = urlProblem(n.source_url) === null &&
        new URL(cleanUrl(n.source_url)).hostname === 'news.google.com';
      if (googleProxy) undatedGoogle++;
      else undatedNonGoogleIds.push(n.id);
    }
    if (published !== null && published > asOf) flaggedFutureNewsIds.push(n.id);
    if (discovered !== null && discovered <= asOf && discovered >= asOf - 86400000) {
      discovered24h++;
      if (published === null) recentUndated++;
      if (positiveId(n.topic_id)) {
        const counts = recentNewsByTopic.get(n.topic_id) ?? {recent_count:0, undated_count:0};
        counts.recent_count++;
        if (published === null) counts.undated_count++;
        recentNewsByTopic.set(n.topic_id, counts);
      } else {
        recentUnassigned++;
        if (published === null) recentUnassignedUndated++;
      }
    }
    if (n.review_status === 'pending' && discovered !== null && discovered < asOf - 14 * 86400000) {
      pending14d++;
      // Rank review backlog by numeric topic ID only; never print unpublished titles.
      if (positiveId(n.topic_id)) {
        agedPendingNewsByTopic.set(n.topic_id, (agedPendingNewsByTopic.get(n.topic_id) ?? 0) + 1);
      }
    }
  }
  // Measure ongoing intake quality independently of the cumulative backlog.
  const recentNewsTopicRank = [...recentNewsByTopic]
    .map(([topic_id, counts]) => ({topic_id, ...counts}))
    .sort((a,b) => b.undated_count - a.undated_count || b.recent_count - a.recent_count || a.topic_id - b.topic_id);
  const agedNewsTopicRank = [...agedPendingNewsByTopic]
    .map(([topic_id, count]) => ({topic_id, count}))
    .sort((a, b) => b.count - a.count || a.topic_id - b.topic_id);
  // Some imported inbox records may have an added_at but no discovered_at.
  // Use the explicit discovery timestamp when available, otherwise fall back to
  // the ingestion date. Report records with neither rather than silently treating
  // them as fresh; this is triage metadata, not proof of source publication age.
  const oldPendingInboxIds = [];
  const fallbackInboxAgeIds = [];
  const unknownInboxAgeIds = [];
  // Publication and discovery timestamps are separate facts. Future dates are
  // numeric-only human review candidates, never automatically corrected dates.
  const futureInboxPublishedIds = [];
  const futureInboxDiscoveryIds = [];
  const futureInboxAddedIds = [];
  const inboxPublicationAfterDiscoveryIds = [];
  for (const item of inbox) {
    const published = timestamp(item.published_at, 'inbox.published_at');
    const discovered = timestamp(item.discovered_at, 'inbox.discovered_at');
    const added = timestamp(item.added_at, 'inbox.added_at');
    if (published !== null && published > asOf) futureInboxPublishedIds.push(item.id);
    if (discovered !== null && discovered > asOf) futureInboxDiscoveryIds.push(item.id);
    if (added !== null && added > asOf) futureInboxAddedIds.push(item.id);
    // Do not substitute added_at for the actual discovery timestamp.
    if (published !== null && discovered !== null && published - discovered > 86400000) inboxPublicationAfterDiscoveryIds.push(item.id);
  }
  futureInboxPublishedIds.sort((a,b)=>a-b);
  futureInboxDiscoveryIds.sort((a,b)=>a-b);
  futureInboxAddedIds.sort((a,b)=>a-b);
  inboxPublicationAfterDiscoveryIds.sort((a,b)=>a-b);
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
  // These measure only direct inbox assignments, NOT whether watch polling is working.
  // Inactive topics can retain historical inbox records without indicating an error.
  const assignedResearchWatchIds = new Set(inbox.map(i => i.watch_topic_id).filter(positiveId));
  const activeWatchesWithoutInboxIds = researchWatches
    .filter(w => w.active === true && !assignedResearchWatchIds.has(w.id))
    .map(w => w.id).sort((a,b) => a-b);
  const inactiveWatchesWithInboxIds = researchWatches
    .filter(w => w.active !== true && assignedResearchWatchIds.has(w.id))
    .map(w => w.id).sort((a,b) => a-b);
  const topicWithItem = new Set(news.map(n => n.topic_id).filter(x => x != null));
  // Watch telemetry is not the same as collector health. Distinguish missing,
  // old and future timestamps, and expose only bounded numeric IDs.
  function watchFreshness(watches, column) {
    const groups = { missing: [], old: [], future: [], recent: [] };
    for (const watch of watches) {
      if (watch.active !== true) continue;
      const seen = timestamp(watch[column], column);
      const group = seen === null ? 'missing' :
        seen > asOf ? 'future' : seen < asOf - 86400000 ? 'old' : 'recent';
      groups[group].push(watch.id);
    }
    return Object.fromEntries(Object.entries(groups).map(([key, ids]) => {
      ids.sort((a,b) => a-b);
      return [key, { count: ids.length, ids: ids.slice(0,25),
        omitted_ids: Math.max(0, ids.length - 25) }];
    }));
  }
  const researchWatchFreshness = watchFreshness(researchWatches, 'last_checked_at');
  const newsWatchFreshness = watchFreshness(newsWatches, 'last_collected_at');
  // Keep legacy stale count as missing + old; future is a separate anomaly.
  const staleCount = freshness => freshness.missing.count + freshness.old.count;
  const activeFeeds = feeds.filter(f => f.active === true);
  const feedLastSuccessUnknownOrOld = activeFeeds.filter(f => {
    const date = timestamp(f.last_success_at, 'feed.last_success_at');
    // A future-dated success cannot establish a successful poll in the past 24 hours.
    return date === null || date < asOf - 86400000 || date > asOf;
  }).length;
  const futureFeedSuccessIds = activeFeeds.filter(f => {
    const date = timestamp(f.last_success_at, 'feed.last_success_at');
    return date !== null && date > asOf;
  }).map(f => f.feed_id).sort((a,b) => a-b);
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
  unknownPendingNewsDiscoveryIds.sort((a,b) => a-b);
  futureNewsDiscoveryIds.sort((a,b) => a-b);
  newsPublicationAfterDiscoveryIds.sort((a,b)=>a-b);
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
      undated_discovered_last_24h: recentUndated,
      recent_publication_date_by_topic: recentNewsTopicRank.slice(0,10),
      omitted_recent_publication_date_topics: Math.max(0,recentNewsTopicRank.length-10),
      recent_without_topic: recentUnassigned,
      recent_undated_without_topic: recentUnassignedUndated,
      pending_over_14d: pending14d,
      pending_without_discovery_timestamp: unknownPendingNewsDiscoveryIds.length,
      unknown_discovery_pending_item_ids: unknownPendingNewsDiscoveryIds.slice(0,25),
      omitted_unknown_discovery_pending_item_ids: Math.max(0, unknownPendingNewsDiscoveryIds.length - 25),
      publication_more_than_24h_after_discovery: newsPublicationAfterDiscoveryIds.length,
      publication_after_discovery_item_ids: newsPublicationAfterDiscoveryIds.slice(0,25),
      omitted_publication_after_discovery_item_ids: Math.max(0, newsPublicationAfterDiscoveryIds.length - 25),
      discovered_after_snapshot_time: futureNewsDiscoveryIds.length,
      future_discovered_item_ids: futureNewsDiscoveryIds.slice(0,25),
      omitted_future_discovered_item_ids: Math.max(0, futureNewsDiscoveryIds.length - 25),
      // Capped, deterministic topic-level triage; counts are not evidence quality scores.
      aged_pending_topic_counts: agedNewsTopicRank.slice(0, 10),
      omitted_aged_pending_topics: Math.max(0, agedNewsTopicRank.length - 10),
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
      pending_with_added_at_fallback: fallbackInboxAgeIds.length,
      fallback_age_item_ids: fallbackInboxAgeIds.slice(0,25),
      omitted_fallback_age_item_ids: Math.max(0, fallbackInboxAgeIds.length - 25),
      pending_without_any_discovery_or_added_date: unknownInboxAgeIds.length,
      unknown_age_item_ids: unknownInboxAgeIds.slice(0,25),
      omitted_unknown_age_item_ids: Math.max(0, unknownInboxAgeIds.length - 25),
      ...inboxUrlQuality,
      missing_publication_timestamp: inbox.filter(i => absent(i.published_at)).length,
      publication_timestamps_after_snapshot_time: futureInboxPublishedIds.length,
      future_published_item_ids: futureInboxPublishedIds.slice(0,25),
      omitted_future_published_item_ids: Math.max(0, futureInboxPublishedIds.length-25),
      publication_more_than_24h_after_discovery: inboxPublicationAfterDiscoveryIds.length,
      publication_after_discovery_item_ids: inboxPublicationAfterDiscoveryIds.slice(0,25),
      omitted_publication_after_discovery_item_ids: Math.max(0, inboxPublicationAfterDiscoveryIds.length - 25),
      discovered_after_snapshot_time: futureInboxDiscoveryIds.length,
      future_discovered_item_ids: futureInboxDiscoveryIds.slice(0,25),
      omitted_future_discovered_item_ids: Math.max(0, futureInboxDiscoveryIds.length-25),
      // Intake timestamps are not publication dates; future intake requires manual reconciliation.
      added_after_snapshot_time: futureInboxAddedIds.length,
      future_added_item_ids: futureInboxAddedIds.slice(0,25),
      omitted_future_added_item_ids: Math.max(0, futureInboxAddedIds.length-25),
      without_watch_topic: inbox.filter(i => i.watch_topic_id == null).length,
      without_related_case: inbox.filter(i => i.related_case_id == null).length,
      exact_url_duplicate_groups: repeatedGroups(inboxUrls)
    },
    sources: {
      total: sources.length,
      published_marked: sources.filter(s => s.published === true).length,
      ...sourceUrlQuality,
      published_marked_missing_date: sources.filter(s => s.published === true && absent(s.publication_date)).length,
      // Calendar-day review signal, including sources not yet marked published.
      // This is not proof that a planned release date is inaccurate.
      publication_dates_after_snapshot_utc_day: futureSourcePublicationIds.length,
      future_publication_date_source_ids: futureSourcePublicationIds.slice(0,25),
      omitted_future_publication_date_source_ids: Math.max(0, futureSourcePublicationIds.length - 25),
      published_marked_missing_publisher: sources.filter(s => s.published === true && absent(s.publisher)).length,
      // Sorted and capped IDs allow direct editorial assignment without leaking research content.
      published_missing_date_source_ids: sourceDateGapIds.slice(0,25),
      omitted_published_missing_date_source_ids: Math.max(0, sourceDateGapIds.length - 25),
      published_missing_publisher_source_ids: sourcePublisherGapIds.slice(0,25),
      omitted_published_missing_publisher_source_ids: Math.max(0, sourcePublisherGapIds.length - 25),
      published_missing_url_source_ids: sourceUrlGapIds.slice(0,25),
      omitted_published_missing_url_source_ids: Math.max(0, sourceUrlGapIds.length - 25),
      // Do not report archive-only documents as having no syntactically valid locator.
      published_marked_archive_only: archiveOnlySourceIds.length,
      published_archive_only_source_ids: archiveOnlySourceIds.slice(0,25),
      omitted_published_archive_only_source_ids: Math.max(0, archiveOnlySourceIds.length - 25),
      published_marked_without_valid_url_or_archive: noValidLocatorSourceIds.length,
      published_no_valid_locator_source_ids: noValidLocatorSourceIds.slice(0,25),
      omitted_published_no_valid_locator_source_ids: Math.max(0, noValidLocatorSourceIds.length - 25),
      published_marked_unknown_archive_field: unknownArchiveFieldSourceIds.length,
      published_unknown_archive_field_source_ids: unknownArchiveFieldSourceIds.slice(0,25),
      omitted_published_unknown_archive_field_source_ids: Math.max(0, unknownArchiveFieldSourceIds.length - 25),
      published_marked_malformed_archive_url: malformedArchiveSourceIds.length,
      published_malformed_archive_source_ids: malformedArchiveSourceIds.slice(0,25),
      omitted_published_malformed_archive_source_ids: Math.max(0, malformedArchiveSourceIds.length - 25),
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
      // Empty assignment != no research or collector outage; review scope manually.
      active_research_without_direct_inbox: activeWatchesWithoutInboxIds.length,
      active_research_without_direct_inbox_ids: activeWatchesWithoutInboxIds.slice(0,25),
      omitted_active_research_without_inbox_ids: Math.max(0, activeWatchesWithoutInboxIds.length-25),
      inactive_research_with_inbox_records: inactiveWatchesWithInboxIds.length,
      inactive_research_with_inbox_ids: inactiveWatchesWithInboxIds.slice(0,25),
      omitted_inactive_research_with_inbox_ids: Math.max(0, inactiveWatchesWithInboxIds.length-25),
      stale_research_timestamp_fields: staleCount(researchWatchFreshness),
      research_timestamp_freshness: researchWatchFreshness,
      active_news: newsWatches.filter(w=>w.active === true).length,
      stale_news_timestamp_fields: staleCount(newsWatchFreshness),
      news_timestamp_freshness: newsWatchFreshness,
      active_collectors: activeFeeds.length,
      collectors_without_success_in_24h: feedLastSuccessUnknownOrOld,
      collectors_future_success_timestamp: futureFeedSuccessIds.length,
      future_success_feed_ids: futureFeedSuccessIds.slice(0,25),
      omitted_future_success_feed_ids: Math.max(0, futureFeedSuccessIds.length-25),
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
