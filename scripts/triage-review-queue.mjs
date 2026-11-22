// Offline editorial triage only. Does not fetch, classify truth, link, publish, or write records.
// Usage: node scripts/triage-review-queue.mjs full-local-snapshot.json
// Snapshot shape: { as_of, expected_counts:{ news_items, research_inbox, sources },
//                    news_items:[...], research_inbox:[...], sources:[...] }
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 86_400_000;
const REASONS = Object.freeze({
  primary_kind_missing_date: 100,
  shared_source_record_url: 90,
  shared_news_inbox_url: 80,
  inbox_unassigned_watch: 70,
  inbox_missing_date: 65,
  google_proxy_missing_date: 60,
  aged_pending_14d: 50,
  other_missing_date: 40
});
const PRIMARY_KINDS = new Set(['primary_document', 'legal_record', 'research_paper']);

function validInstant(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new Error('Invalid timestamp');
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error('Invalid timestamp');
  return ms;
}

function validUrl(value) {
  if (typeof value !== 'string' || !value || /\s/.test(value)) throw new Error('Invalid URL');
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Invalid URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname ||
      parsed.username || parsed.password) throw new Error('Invalid URL');
  return parsed.hostname.toLowerCase().replace(/\.$/, '');
}

function isRecord(row) {
  return row !== null && typeof row === 'object' && !Array.isArray(row);
}

export function triageReviewQueue(snapshot, { limit = 50 } = {}) {
  if (!isRecord(snapshot) || !isRecord(snapshot.expected_counts) ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
    throw new Error('Invalid audit parameters');
  }
  const now = validInstant(snapshot.as_of);
  const collections = {};
  for (const name of ['news_items', 'research_inbox', 'sources']) {
    const data = snapshot[name];
    const expected = snapshot.expected_counts[name];
    if (!Array.isArray(data) || !Number.isSafeInteger(expected) ||
        expected < 0 || expected !== data.length) {
      throw new Error('Incomplete snapshot');
    }
    const ids = new Set();
    for (const row of data) {
      if (!isRecord(row) || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id)) {
        throw new Error('Invalid record identifier');
      }
      ids.add(row.id);
      if (name === 'sources') {
        if (row.url !== null && row.url !== undefined) validUrl(row.url);
        continue;
      }
      validUrl(row.source_url);
      if (!['pending', 'reviewed', 'dismissed'].includes(row.review_status)) {
        throw new Error('Invalid review status');
      }
      const discovered = validInstant(row.discovered_at);
      if (discovered > now + DAY) throw new Error('Discovery timestamp in future');
      if (name === 'news_items') {
        if (typeof row.content_kind !== 'string') throw new Error('Invalid content kind');
        if (row.published_at != null) validInstant(row.published_at);
      } else {
        if (row.published_at != null) validInstant(row.published_at);
        if (row.watch_topic_id != null &&
            (!Number.isSafeInteger(row.watch_topic_id) || row.watch_topic_id <= 0)) {
          throw new Error('Invalid watch identifier');
        }
      }
    }
    collections[name] = data;
  }

  // Exact URL identity is a potential editorial correlation, not corroboration or a merge key.
  const inboxUrls = new Set(collections.research_inbox.map(r => r.source_url));
  const newsUrls = new Set(collections.news_items.map(r => r.source_url));
  const sourceUrls = new Set(collections.sources.filter(s => s.url).map(s => s.url));
  const candidates = [];

  for (const n of collections.news_items) {
    if (n.review_status !== 'pending') continue;
    const reasons = [];
    const missingDate = n.published_at == null;
    const hostname = validUrl(n.source_url);
    if (missingDate && PRIMARY_KINDS.has(n.content_kind)) reasons.push('primary_kind_missing_date');
    if (sourceUrls.has(n.source_url)) reasons.push('shared_source_record_url');
    if (inboxUrls.has(n.source_url)) reasons.push('shared_news_inbox_url');
    if (missingDate && hostname === 'news.google.com') reasons.push('google_proxy_missing_date');
    if (validInstant(n.discovered_at) < now - 14 * DAY) reasons.push('aged_pending_14d');
    if (missingDate && !PRIMARY_KINDS.has(n.content_kind) && hostname !== 'news.google.com') {
      reasons.push('other_missing_date');
    }
    if (reasons.length) candidates.push({
      queue: 'news_items', id: n.id, reasons,
      age: validInstant(n.discovered_at)
    });
  }
  for (const i of collections.research_inbox) {
    if (i.review_status !== 'pending') continue;
    const reasons = [];
    if (i.watch_topic_id == null) reasons.push('inbox_unassigned_watch');
    if (i.published_at == null) reasons.push('inbox_missing_date');
    if (newsUrls.has(i.source_url)) reasons.push('shared_news_inbox_url');
    if (validInstant(i.discovered_at) < now - 14 * DAY) reasons.push('aged_pending_14d');
    if (reasons.length) candidates.push({
      queue: 'research_inbox', id: i.id, reasons,
      age: validInstant(i.discovered_at)
    });
  }
  // Heuristic ranking describes editorial work urgency, never reliability or evidence strength.
  for (const c of candidates) c.priority = Math.max(...c.reasons.map(r => REASONS[r]));
  candidates.sort((a, b) => b.priority - a.priority ||
    b.reasons.length - a.reasons.length || a.age - b.age ||
    a.queue.localeCompare(b.queue) || a.id - b.id);
  const reason_counts = Object.fromEntries(Object.keys(REASONS).map(r =>
    [r, candidates.filter(c => c.reasons.includes(r)).length]));
  return {
    totals: {
      news_items: collections.news_items.length,
      research_inbox: collections.research_inbox.length,
      sources: collections.sources.length,
      candidates: candidates.length,
      shown: Math.min(limit, candidates.length),
      omitted: Math.max(0, candidates.length - limit)
    },
    reason_counts,
    // Never output URLs, titles, source text, or notes from input.
    review_queue: candidates.slice(0, limit).map(({ queue, id, priority, reasons }) =>
      ({ queue, id, priority, reasons }))
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Expected one snapshot');
    const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    process.stdout.write(JSON.stringify(triageReviewQueue(snapshot), null, 2) + '\n');
  } catch {
    // Never echo input, exceptions, URLs, query strings, or private source text.
    process.stderr.write('Triage not completed: invalid or incomplete local snapshot.\n');
    process.exitCode = 1;
  }
}
