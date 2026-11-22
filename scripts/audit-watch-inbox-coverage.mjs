/**
 * Advisory-only coverage audit linking research watches to the review inbox.
 * Works on caller-supplied local JSON arrays; has no network/database access,
 * creates no links, and never outputs text, URLs, credentials or evidence claims.
 * An empty watch inbox is not evidence that no research exists.
 */

function positiveId(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`);
  }
  return value;
}

function uniqueIndex(records, name) {
  const byId = new Map();
  for (const record of records) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new TypeError(`${name} record must be an object`);
    }
    const id = positiveId(record.id, `${name}.id`);
    if (byId.has(id)) throw new TypeError(`${name} contains duplicate ID ${id}`);
    byId.set(id, record);
  }
  return byId;
}

const ascending = (a, b) => a - b;

export function auditWatchInboxCoverage({researchWatches = [], researchInbox = []} = {}) {
  if (!Array.isArray(researchWatches) || !Array.isArray(researchInbox)) {
    throw new TypeError('Expected researchWatches and researchInbox arrays');
  }
  const watchesById = uniqueIndex(researchWatches, 'researchWatches');
  uniqueIndex(researchInbox, 'researchInbox');
  const counts = new Map([...watchesById.keys()].map(id => [id, {total: 0, pending: 0}]));
  const unassigned = [];
  const unknownLinks = [];
  const inactiveLinks = [];

  for (const item of researchInbox) {
    if (item.watch_topic_id == null) {
      unassigned.push(item.id);
      continue;
    }
    const watchId = positiveId(item.watch_topic_id, 'researchInbox.watch_topic_id');
    const watch = watchesById.get(watchId);
    if (!watch) {
      unknownLinks.push({inbox_id: item.id, watch_id: watchId});
      continue;
    }
    if (watch.active !== true) inactiveLinks.push(item.id);
    const stats = counts.get(watchId);
    stats.total += 1;
    if (item.review_status === 'pending') stats.pending += 1;
  }

  const activeWatchIds = [...watchesById.values()]
    .filter(w => w.active === true)
    .map(w => w.id)
    .sort(ascending);
  const activeWatchInboxCounts = activeWatchIds.map(id => ({
    watch_id: id,
    inbox_records: counts.get(id).total,
    pending_records: counts.get(id).pending
  }));

  return {
    research_watch_count: researchWatches.length,
    active_watch_count: activeWatchIds.length,
    research_inbox_count: researchInbox.length,
    active_watches_with_no_inbox_ids: activeWatchIds.filter(id => counts.get(id).total === 0),
    active_watches_with_only_pending_inbox_ids: activeWatchIds.filter(id =>
      counts.get(id).total > 0 && counts.get(id).total === counts.get(id).pending),
    unassigned_inbox_ids: unassigned.sort(ascending),
    unknown_watch_links: unknownLinks.sort((a,b) => a.inbox_id - b.inbox_id),
    inbox_ids_linked_to_inactive_watches: inactiveLinks.sort(ascending),
    active_watch_inbox_counts: activeWatchInboxCounts,
    assessment: 'Operational coverage only. No inbox link is not proof of no research, and pending records are not verified evidence.'
  };
}
