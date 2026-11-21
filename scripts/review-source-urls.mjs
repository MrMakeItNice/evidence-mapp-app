import { readFileSync } from 'node:fs';

// Advisory-only URL review. No network, database access, or record mutation.
// Exclude credential-bearing URLs from audit output and matching; review by record ID.
const SENSITIVE_KEYS = new Set(['access_token', 'api_key', 'apikey', 'auth', 'authorization', 'client_secret', 'id_token', 'password', 'secret', 'sig', 'signature', 'token', 'x-amz-credential', 'x-amz-security-token', 'x-amz-signature', 'x-goog-credential', 'x-goog-signature']);
const TRACKING_KEYS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid']);

export function inspectSourceUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { normalized_url: null, flags: ['missing_url'] };
  }
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return { normalized_url: null, flags: ['invalid_url'] };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { normalized_url: null, flags: ['unsupported_scheme'] };
  }

  const flags = [];
  if (url.protocol === 'http:') flags.push('unencrypted_http');
  if (url.hostname === 'news.google.com') flags.push('google_news_proxy_review_publisher');
  if ([...url.searchParams.keys()].some((key) => key.includes(';'))) {
    flags.push('suspicious_semicolon_query_key');
  }
  if (url.username || url.password || [...url.searchParams.keys()].some((key) => SENSITIVE_KEYS.has(key.toLowerCase()))) {
    flags.push('sensitive_credentials_in_url');
    return { normalized_url: null, flags };
  }

  // Only remove widely recognized tracking parameters and fragments. Never
  // discard document IDs, filenames, language, page numbers, or other query keys.
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || TRACKING_KEYS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  return { normalized_url: url.toString(), flags };
}

export function reviewSourceUrls(records) {
  if (!Array.isArray(records)) throw new TypeError('Expected a JSON array of source records');
  const issues = [];
  const buckets = new Map();
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new TypeError(`Source record ${index} must be an object`);
    }
    const url = record.source_url ?? record.url;
    const { normalized_url, flags } = inspectSourceUrl(url);
    const id = Number.isSafeInteger(record.id) && record.id > 0 ? record.id : `row_${index + 1}`;
    // Report IDs and flags only. URL paths and unknown query keys can contain
    // opaque credentials that cannot safely be recognized by any blocklist.
    if (flags.length) issues.push({ id, flags });
    if (normalized_url) {
      if (!buckets.has(normalized_url)) buckets.set(normalized_url, []);
      buckets.get(normalized_url).push(id);
    }
  }
  const duplicate_suggestions = [...buckets.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([, ids]) => ({ ids }))
    .sort((a, b) => b.ids.length - a.ids.length || String(a.ids[0]).localeCompare(String(b.ids[0])));
  return {
    record_count: records.length,
    issues,
    duplicate_suggestions,
    caveat: 'Review flags and duplicate candidates manually; distinct documents can share paths or parameters. No records were modified.',
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const data = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    process.stdout.write(`${JSON.stringify(reviewSourceUrls(JSON.parse(data)), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Source URL review failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
