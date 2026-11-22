// Offline, review-only coverage audit. Never fetches or updates live records.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function requireRows(data, key) {
  if (!Array.isArray(data?.[key])) throw new Error('Expected arrays: topics, items, feeds');
  return data[key];
}
function requireId(value) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid identifier');
}
function linkedId(value) {
  if (value === null || value === undefined) return null;
  requireId(value);
  return value;
}

/**
 * Input: { topics: [{id, active}], items: [{topic_id}], feeds: [{topic_id, active}] }.
 * Output uses IDs/counts only. An empty editorial topic is NOT a collector failure.
 * This tool does not use titles, source links, notes, or timestamps.
 */
export function auditTopicCollectorCoverage(data) {
  const topics = requireRows(data, 'topics');
  const items = requireRows(data, 'items');
  const feeds = requireRows(data, 'feeds');
  const byId = new Map();

  for (const topic of topics) {
    requireId(topic?.id);
    if (typeof topic.active !== 'boolean' || byId.has(topic.id)) {
      throw new Error('Invalid or duplicate topic');
    }
    byId.set(topic.id, { topic_id: topic.id, active: topic.active, item_count: 0, active_feed_count: 0 });
  }

  const unknownItemTopics = new Set();
  const unknownFeedTopics = new Set();
  let unassignedItems = 0;
  let unassignedActiveFeeds = 0;

  for (const item of items) {
    const id = linkedId(item?.topic_id);
    if (id === null) { unassignedItems++; continue; }
    if (!byId.has(id)) { unknownItemTopics.add(id); continue; }
    byId.get(id).item_count++;
  }
  for (const feed of feeds) {
    if (typeof feed?.active !== 'boolean') throw new Error('Invalid feed status');
    const id = linkedId(feed.topic_id);
    if (!feed.active) continue;
    if (id === null) { unassignedActiveFeeds++; continue; }
    if (!byId.has(id)) { unknownFeedTopics.add(id); continue; }
    byId.get(id).active_feed_count++;
  }

  const activeTopics = [...byId.values()].filter(t => t.active).sort((a, b) => a.topic_id - b.topic_id);
  const rows = activeTopics.map(t => ({
    topic_id: t.topic_id,
    item_count: t.item_count,
    active_feed_count: t.active_feed_count,
    classification: t.item_count > 0
      ? 'has_items'
      : t.active_feed_count > 0
        ? 'empty_with_active_feed'
        : 'empty_without_active_feed'
  }));
  return {
    scope: { topics_checked: topics.length, active_topics: rows.length, items_checked: items.length, feeds_checked: feeds.length },
    summary: {
      has_items: rows.filter(r => r.classification === 'has_items').length,
      empty_with_active_feed: rows.filter(r => r.classification === 'empty_with_active_feed').length,
      empty_without_active_feed: rows.filter(r => r.classification === 'empty_without_active_feed').length,
      unassigned_items: unassignedItems,
      unassigned_active_feeds: unassignedActiveFeeds
    },
    topic_rows: rows,
    unknown_item_topic_ids: [...unknownItemTopics].sort((a,b) => a-b),
    unknown_active_feed_topic_ids: [...unknownFeedTopics].sort((a,b) => a-b)
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Input path required');
    const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    process.stdout.write(JSON.stringify(auditTopicCollectorCoverage(data), null, 2) + '\n');
  } catch {
    // Avoid echoing invalid source content, paths, or secrets.
    process.stderr.write('Offline coverage audit failed: check input JSON structure.\n');
    process.exitCode = 1;
  }
}
