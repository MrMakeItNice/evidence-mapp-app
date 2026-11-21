import { readFileSync } from 'node:fs';

/**
 * Evidence Atlas offline, advisory-only cross-collection URL overlap audit.
 * Expects { inbox: research_inbox[], newsItems: news_items[] } from a local
 * read-only snapshot. Never performs network/database I/O or modifies records.
 *
 * Strict matching: only identical trimmed URL strings (query and fragment
 * preserved). Do not collapse distinct document IDs, tracking parameters,
 * proxy articles, archive versions, or different protocols.
 * Output is limited to IDs, booleans, and counts; URLs and article text never
 * appear in the report. A URL match is NOT proof of duplicated research.
 */
const PRIVATE_QUERY_KEYS = new Set([
  'access_token', 'api_key', 'apikey', 'auth', 'authorization',
  'client_secret', 'id_token', 'password', 'secret', 'sig',
  'signature', 'token', 'x-amz-credential', 'x-amz-security-token',
  'x-amz-signature', 'x-goog-credential', 'x-goog-signature',
]);

function validId(id) { return Number.isSafeInteger(id) && id > 0; }

function urlKey(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const key = value.trim();
  try {
    const url = new URL(key);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if ([...url.searchParams.keys()].some(k => PRIVATE_QUERY_KEYS.has(k.toLowerCase()))) return null;
    return key;
  } catch { return null; }
}

function normalizedTitle(value) {
  return typeof value === 'string' && value.trim()
    ? value.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ')
    : null;
}

function suppliedDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|\s|$)/.test(value)
    ? value.slice(0, 10) : null;
}

export function auditInboxNewsOverlaps({ inbox = [], newsItems = [] } = {}) {
  if (!Array.isArray(inbox) || !Array.isArray(newsItems)) {
    throw new TypeError('Expected inbox and newsItems arrays');
  }
  const newsByUrl = new Map();
  const seenNewsIds = new Set();
  let ignoredNews = 0;
  for (const item of newsItems) {
    if (!item || !validId(item.id) || seenNewsIds.has(item.id)) { ignoredNews++; continue; }
    seenNewsIds.add(item.id);
    const key = urlKey(item.source_url);
    if (!key) { ignoredNews++; continue; }
    const bucket = newsByUrl.get(key) ?? [];
    bucket.push(item);
    newsByUrl.set(key, bucket);
  }

  const candidatePairs = [];
  const ambiguousInboxIds = [];
  const seenInboxIds = new Set();
  let ignoredInbox = 0;
  for (const item of inbox) {
    if (!item || !validId(item.id) || seenInboxIds.has(item.id)) { ignoredInbox++; continue; }
    seenInboxIds.add(item.id);
    const key = urlKey(item.source_url);
    if (!key) { ignoredInbox++; continue; }
    const matches = newsByUrl.get(key) ?? [];
    if (matches.length > 1) { ambiguousInboxIds.push(item.id); continue; }
    if (matches.length !== 1) continue;
    const news = matches[0];
    const inboxTitle = normalizedTitle(item.title);
    const newsTitle = normalizedTitle(news.headline);
    const inboxDate = suppliedDate(item.published_at);
    const newsDate = suppliedDate(news.published_at);
    candidatePairs.push({
      inbox_id: item.id,
      news_id: news.id,
      title_match: inboxTitle && newsTitle ? inboxTitle === newsTitle : null,
      supplied_date_match: inboxDate && newsDate ? inboxDate === newsDate : null,
      match_reason: 'identical_trimmed_url_only',
      review_status: 'human_review_required',
    });
  }
  candidatePairs.sort((a, b) => a.inbox_id - b.inbox_id || a.news_id - b.news_id);
  ambiguousInboxIds.sort((a, b) => a - b);
  return {
    inspected_inbox: inbox.length,
    inspected_news: newsItems.length,
    ignored_inbox_rows: ignoredInbox,
    ignored_news_rows: ignoredNews,
    candidate_pair_count: candidatePairs.length,
    candidate_pairs: candidatePairs,
    ambiguous_inbox_ids: ambiguousInboxIds,
    caveat: 'Exact URL overlaps can represent legitimate distinct research and news records. Never merge, link, publish, or infer claim support without human examination.',
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const json = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    process.stdout.write(JSON.stringify(auditInboxNewsOverlaps(JSON.parse(json)), null, 2) + '\n');
  } catch {
    process.stderr.write('Cross-collection overlap audit failed (invalid JSON or input).\n');
    process.exitCode = 1;
  }
}
