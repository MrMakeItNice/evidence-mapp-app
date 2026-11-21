import { readFileSync } from 'node:fs';

/**
 * Offline, read-only audit of exact source-library/news-record URL relationships.
 * Input: { sources: [{id,url,publisher,publication_date}],
 *          newsItems: [{id,source_url,publisher,published_at}] }.
 *
 * Only equal trimmed URL strings match. Query, fragment, path, protocol, casing,
 * and document identifiers are NEVER stripped or canonicalized. The report
 * emits only IDs and comparison categories, not URLs, titles, dates, or publishers.
 * Matching is a REVIEW candidate, not evidence of an identical document or
 * permission to change a record. No network or database access.
 */
const MAX_ROWS = 100000;
const PRIVATE_QUERY_KEYS = new Set([
  'access_token', 'apikey', 'api_key', 'auth', 'authorization', 'client_secret',
  'id_token', 'password', 'secret', 'sig', 'signature', 'token',
  'x-amz-credential', 'x-amz-security-token', 'x-amz-signature',
  'x-goog-credential', 'x-goog-signature',
]);

function idOf(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)
    || !Number.isSafeInteger(row.id) || row.id <= 0) {
    throw new TypeError('Invalid row or record id');
  }
  return row.id;
}
function validRows(rows) {
  if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new TypeError('Invalid input array');
  const seen = new Set();
  for (const row of rows) {
    const id = idOf(row);
    if (seen.has(id)) throw new TypeError('Repeated record id');
    seen.add(id);
  }
}
function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  try {
    const parsed = new URL(raw);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password
      || !parsed.hostname || /[\x00-\x1f\x7f]/.test(raw)) return null;
    if ([...parsed.searchParams.keys()].some(key => PRIVATE_QUERY_KEYS.has(key.toLowerCase()))) return null;
    return raw;
  } catch { return null; }
}
function publisher(value) {
  return typeof value === 'string' && value.trim()
    ? value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ') : null;
}
function dateDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|[T\s])/.test(value)) return null;
  const day = value.slice(0, 10);
  const parsed = new Date(day + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : null;
}
function comparison(a, b) {
  if (a == null && b == null) return 'both_missing_or_invalid';
  if (a == null || b == null) return 'one_missing_or_invalid';
  return a === b ? 'same' : 'different';
}
function byUrl(rows, field) {
  const grouped = new Map();
  let ignored = 0;
  for (const row of rows) {
    const url = safeUrl(row[field]);
    if (!url) { ignored++; continue; }
    if (!grouped.has(url)) grouped.set(url, []);
    grouped.get(url).push(row);
  }
  return { grouped, ignored };
}

export function auditSourceNewsLinks({ sources = [], newsItems = [] } = {}) {
  validRows(sources);
  validRows(newsItems);
  const sourceIdx = byUrl(sources, 'url');
  const newsIdx = byUrl(newsItems, 'source_url');
  const candidates = [], ambiguous = [];
  for (const [url, ss] of sourceIdx.grouped) {
    const nn = newsIdx.grouped.get(url);
    if (!nn?.length) continue;
    if (ss.length !== 1 || nn.length !== 1) {
      ambiguous.push({ source_ids:ss.map(v=>v.id).sort((a,b)=>a-b),
        news_ids:nn.map(v=>v.id).sort((a,b)=>a-b) });
      continue;
    }
    const s = ss[0], n = nn[0];
    candidates.push({ source_id:s.id, news_id:n.id,
      publisher_comparison:comparison(publisher(s.publisher), publisher(n.publisher)),
      publication_day_comparison:comparison(dateDay(s.publication_date),dateDay(n.published_at)),
      review_status:'human_review_required' });
  }
  candidates.sort((a,b)=>a.source_id-b.source_id || a.news_id-b.news_id);
  ambiguous.sort((a,b)=>a.source_ids[0]-b.source_ids[0]);
  return {
    inspected_sources:sources.length, inspected_news:newsItems.length,
    ignored_source_urls:sourceIdx.ignored, ignored_news_urls:newsIdx.ignored,
    candidate_pair_count:candidates.length, candidates, ambiguous_url_groups:ambiguous,
    caveat:'Exact URL equality alone does not prove the same version, editorial purpose, or publication date. Compare primary documents and provenance manually; never auto-link, edit, merge, or publish.'
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const raw = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    process.stdout.write(JSON.stringify(auditSourceNewsLinks(JSON.parse(raw)), null, 2) + '\n');
  } catch {
    process.stderr.write('Source/news audit failed: invalid local snapshot.\n');
    process.exitCode = 1;
  }
}
