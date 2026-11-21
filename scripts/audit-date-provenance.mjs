import { readFileSync } from 'node:fs';

/**
 * Evidence Atlas advisory-only chronology audit for a caller-supplied JSON snapshot.
 * No database/network I/O, publication, record repair, or date imputation.
 * Compares CALENDAR DAYS with conservative tolerance to avoid false precision
 * from absent/unknown publication time zones. All alerts need human review.
 * Never echoes headlines, URLs, names, narrative, or raw timestamp strings.
 */

const DAY_MS = 86_400_000;
const MAX_ROWS = 100_000;

function dayIndex(value) {
  if (value === null || value === undefined || value === '') return { status: 'missing' };
  if (typeof value !== 'string') return { status: 'invalid' };
  // Date-only or ISO-like timestamp; do not accept text with embedded dates.
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)$/.exec(value);
  if (!match) return { status: 'invalid' };
  const [_, yearString, monthString, dateString] = match;
  const y = Number(yearString), m = Number(monthString), d = Number(dateString);
  if (y < 1000 || m < 1 || m > 12 || d < 1 || d > 31) return { status: 'invalid' };
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() + 1 !== m || check.getUTCDate() !== d) return { status: 'invalid' };
  // Validate time without using Date.parse's permissive overflow handling.
  const time = value.slice(10);
  if (time) {
    const t = /[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|([+-])(\d{2}):?(\d{2}))?$/.exec(time);
    if (!t || Number(t[1]) > 23 || Number(t[2]) > 59 || Number(t[3] ?? 0) > 59 ||
        (t[4] && (Number(t[5]) > 23 || Number(t[6]) > 59))) return { status: 'invalid' };
  }
  return { status: 'ok', day: Date.UTC(y, m - 1, d) / DAY_MS };
}

function validId(value) { return Number.isSafeInteger(value) && value > 0; }

function auditRows(rows, { published, discovered, asOfDay, useDiscovery }) {
  const counts = { inspected: rows.length, valid_ids: 0, ignored_rows: 0, missing_publication: 0,
    invalid_publication: 0, missing_discovery: 0, invalid_discovery: 0,
    future_publication: 0, future_discovery: 0, published_after_discovery: 0 };
  const alerts = [];
  const seenIds = new Set();
  for (const row of rows) {
    if (!row || !validId(row.id) || seenIds.has(row.id)) { counts.ignored_rows++; continue; }
    seenIds.add(row.id);
    counts.valid_ids++;
    const flags = [];
    const p = dayIndex(row[published]);
    if (p.status === 'missing') { counts.missing_publication++; flags.push('missing_publication'); }
    else if (p.status === 'invalid') { counts.invalid_publication++; flags.push('invalid_publication'); }
    else if (p.day > asOfDay + 1) { counts.future_publication++; flags.push('future_publication'); }
    if (useDiscovery) {
      const d = dayIndex(row[discovered]);
      if (d.status === 'missing') { counts.missing_discovery++; flags.push('missing_discovery'); }
      else if (d.status === 'invalid') { counts.invalid_discovery++; flags.push('invalid_discovery'); }
      else if (d.day > asOfDay + 1) { counts.future_discovery++; flags.push('future_discovery'); }
      if (p.status === 'ok' && d.status === 'ok' && p.day > d.day + 2) {
        counts.published_after_discovery++;
        flags.push('published_after_discovery');
      }
    }
    if (flags.length) alerts.push({ id: row.id, flags });
  }
  alerts.sort((a,b) => a.id - b.id);
  return { counts, alerts };
}

export function auditDateProvenance({ newsItems = [], inbox = [], sources = [], asOf } = {}) {
  if (![newsItems, inbox, sources].every(v => Array.isArray(v) && v.length <= MAX_ROWS)) {
    throw new TypeError('Expected newsItems, inbox, sources arrays (100000 rows maximum each).');
  }
  const clock = dayIndex(asOf);
  if (clock.status !== 'ok') throw new TypeError('Explicit valid ISO or YYYY-MM-DD asOf required.');
  return {
    as_of_day: asOf.slice(0,10),
    news: auditRows(newsItems, { published:'published_at', discovered:'discovered_at', asOfDay:clock.day, useDiscovery:true }),
    research_inbox: auditRows(inbox, { published:'published_at', discovered:'discovered_at', asOfDay:clock.day, useDiscovery:true }),
    sources: auditRows(sources, { published:'publication_date', asOfDay:clock.day, useDiscovery:false }),
    caveat: 'Calendar-day chronology checks only. Missing publication dates and future-dated articles are review prompts, not evidence of error. Never infer or automatically change dates.'
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const input = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    process.stdout.write(JSON.stringify(auditDateProvenance(JSON.parse(input)), null, 2) + '\n');
  } catch {
    process.stderr.write('Chronology audit failed: invalid input.\n');
    process.exitCode = 1;
  }
}
