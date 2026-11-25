import { readFileSync } from 'node:fs';

/**
 * Advisory-only cohort audit for publication-date coverage in news_items snapshots.
 * No network, database connection, date inference, source resolution or writes.
 * Output contains counts and numeric IDs only; it never prints URLs or headlines.
 */
const MAX_ROWS = 100_000;
const SAMPLE_LIMIT = 20;

function sourceCohort(sourceUrl) {
  if (typeof sourceUrl !== 'string' || !sourceUrl.trim()) return 'missing_or_unsafe_url';
  try {
    const url = new URL(sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      return 'missing_or_unsafe_url';
    }
    return url.hostname.toLowerCase() === 'news.google.com'
      ? 'google_news_proxy' : 'other_http_source';
  } catch {
    return 'missing_or_unsafe_url';
  }
}

export function auditProxyPublicationDates({ newsItems = [] } = {}) {
  if (!Array.isArray(newsItems) || newsItems.length > MAX_ROWS) {
    throw new TypeError('Expected newsItems array, maximum 100000 rows.');
  }
  const groups = Object.fromEntries(
    ['google_news_proxy', 'other_http_source', 'missing_or_unsafe_url'].map(name =>
      [name, { total: 0, missing_publication: 0, supplied_publication: 0, missing_sample_ids: [] }])
  );
  let ignored_rows = 0;
  const ids = new Set();
  for (const row of newsItems) {
    if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || ids.has(row.id)) {
      ignored_rows++;
      continue;
    }
    ids.add(row.id);
    const group = groups[sourceCohort(row.source_url)];
    group.total++;
    const missing = row.published_at == null ||
      (typeof row.published_at === 'string' && !row.published_at.trim());
    if (missing) {
      group.missing_publication++;
      if (group.missing_sample_ids.length < SAMPLE_LIMIT) group.missing_sample_ids.push(row.id);
    } else {
      // Supplied is NOT a claim that the timestamp is valid; use chronology audit.
      group.supplied_publication++;
    }
  }
  const missing = Object.values(groups).reduce((sum, g) => sum + g.missing_publication, 0);
  return {
    inspected: newsItems.length,
    valid_unique_ids: ids.size,
    ignored_rows,
    missing_publication_total: missing,
    groups,
    caveat: 'Google News association is descriptive, not proof of cause. Supplied dates are not validated. Review publisher originals before any repair; never impute dates from discovery or auto-publish.'
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const payload = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    process.stdout.write(JSON.stringify(auditProxyPublicationDates(JSON.parse(payload)), null, 2) + '\n');
  } catch {
    process.stderr.write('Proxy publication-date audit failed: invalid input.\n');
    process.exitCode = 1;
  }
}
