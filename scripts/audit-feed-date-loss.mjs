import { readFileSync } from 'node:fs';

/**
 * Advisory-only comparison between captured RSS/Atom entry metadata and news rows.
 * Strict URL equality: never decode proxies, remove document identifiers, infer
 * publication dates, connect to services, or modify records. Output contains
 * counts and IDs only. Caller must supply explicit read-only snapshots.
 */
const MAX_ROWS = 100_000;
const SAMPLE_LIMIT = 20;
const PRIVATE_KEYS = new Set(['token','access_token','id_token','api_key','apikey',
  'authorization','auth','password','secret','client_secret','signature','sig',
  'x-amz-credential','x-amz-signature','x-amz-security-token','x-goog-credential','x-goog-signature']);

function validId(id) { return Number.isSafeInteger(id) && id > 0; }

function safeKey(raw) {
  if (typeof raw !== 'string' || raw.length > 4096 || !raw.trim()) return null;
  const value = raw.trim();
  try {
    const u = new URL(value);
    if (!['https:','http:'].includes(u.protocol) || u.username || u.password ||
        [...u.searchParams.keys()].some(k => PRIVATE_KEYS.has(k.toLowerCase()))) return null;
    return value;
  } catch { return null; }
}

// Classify a supplied feed timestamp, not a verified publisher publication time.
// Avoid accepting numerical epochs, locale-only dates, or prose via Date.parse.
function dateField(row) {
  for (const field of ['isoDate', 'pubDate', 'published']) {
    const value = row[field];
    if (typeof value !== 'string') continue;
    const v = value.trim();
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(v);
    const rfc = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+(?:GMT|UT|[+-]\d{4})$/i.test(v);
    if ((iso || rfc) && Number.isFinite(Date.parse(v))) return field;
  }
  return null;
}

function bucketByUrl(rows, idField, urlField) {
  const buckets = new Map();
  let ignored = 0;
  for (const row of rows) {
    if (!row || !validId(row[idField])) { ignored++; continue; }
    const key = safeKey(row[urlField]);
    if (!key) { ignored++; continue; }
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }
  return { buckets, ignored };
}

export function auditFeedDateLoss({ capturedEntries = [], newsItems = [] } = {}) {
  if (!Array.isArray(capturedEntries) || !Array.isArray(newsItems) ||
      capturedEntries.length > MAX_ROWS || newsItems.length > MAX_ROWS) {
    throw new TypeError('Expected capturedEntries and newsItems arrays, at most 100000 rows each.');
  }
  const captured = bucketByUrl(capturedEntries, 'entry_id', 'source_url');
  const news = bucketByUrl(newsItems, 'id', 'source_url');
  const output = {
    captured_rows: capturedEntries.length, news_rows: newsItems.length,
    ignored_captured_rows: captured.ignored, ignored_news_rows: news.ignored,
    matched_unique_pairs: 0, candidate_date_loss: 0, no_parseable_feed_date: 0,
    db_publication_present: 0, unmatched_capture: 0, ambiguous_url_groups: 0,
    sample_candidates: [],
    caveat: 'A feed timestamp is a capture artifact, not independently verified original publication evidence. Review publisher originals and collector mapping before any repair. Never backfill from discovery time.'
  };
  for (const [key, entries] of captured.buckets) {
    const saved = news.buckets.get(key) ?? [];
    if (!saved.length) { output.unmatched_capture += entries.length; continue; }
    if (entries.length !== 1 || saved.length !== 1) { output.ambiguous_url_groups++; continue; }
    output.matched_unique_pairs++;
    const item = saved[0];
    if (item.published_at != null && String(item.published_at).trim()) {
      output.db_publication_present++;
      continue;
    }
    const field = dateField(entries[0]);
    if (!field) { output.no_parseable_feed_date++; continue; }
    output.candidate_date_loss++;
    if (output.sample_candidates.length < SAMPLE_LIMIT) {
      output.sample_candidates.push({
        news_id: item.id, captured_entry_id: entries[0].entry_id,
        supplied_feed_field: field, status: 'human_review_required'
      });
    }
  }
  output.sample_candidates.sort((a,b) => a.news_id-b.news_id);
  return output;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const raw = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    process.stdout.write(JSON.stringify(auditFeedDateLoss(JSON.parse(raw)), null, 2) + '\n');
  } catch {
    process.stderr.write('Feed date-loss audit failed: invalid input.\n');
    process.exitCode = 1;
  }
}
