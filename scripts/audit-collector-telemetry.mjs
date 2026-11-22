// Offline-only collector telemetry audit. No Supabase client, fetch, writes, or publication.
// Usage: node scripts/audit-collector-telemetry.mjs complete-local-snapshot.json
// Snapshot: { as_of, expected_counts:{agent_control_feeds,agent_control_activity},
//   agent_control_feeds:[...], agent_control_activity:[...] }
// Output contains only feed labels, counts, timestamps and reason codes; no source URLs/errors.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 86_400_000;

function instant(value) {
  const m = typeof value === 'string' &&
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/i.exec(value);
  if (!m) throw new Error('Invalid timestamp');
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zone = m[7];
  const oh = zone.toUpperCase() === 'Z' ? 0 : Number(zone.slice(1, 3));
  const om = zone.toUpperCase() === 'Z' ? 0 : Number(zone.slice(4, 6));
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] ||
      Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59 ||
      oh > 14 || om > 59 || (oh === 14 && om !== 0)) throw new Error('Invalid timestamp');
  const n = Date.parse(value);
  if (!Number.isFinite(n)) throw new Error('Invalid timestamp');
  return n;
}
function optionalInstant(v) { return v == null ? null : instant(v); }
function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function validCount(v) { return Number.isSafeInteger(v) && v >= 0; }

export function auditCollectorTelemetry(snapshot) {
  if (!object(snapshot) || !object(snapshot.expected_counts)) throw new Error('Invalid snapshot');
  const asOf = instant(snapshot.as_of);
  const feeds = snapshot.agent_control_feeds;
  const activity = snapshot.agent_control_activity;
  for (const [name, rows] of [['agent_control_feeds', feeds], ['agent_control_activity', activity]]) {
    if (!Array.isArray(rows) || !validCount(snapshot.expected_counts[name]) ||
        rows.length !== snapshot.expected_counts[name]) throw new Error('Incomplete snapshot');
  }
  const feedNames = new Set();
  const feedIds = new Set();
  for (const f of feeds) {
    if (!object(f) || !Number.isSafeInteger(f.feed_id) || f.feed_id <= 0 ||
        typeof f.name !== 'string' || !f.name.trim() || feedIds.has(f.feed_id) ||
        feedNames.has(f.name) || typeof f.active !== 'boolean' ||
        (f.last_run_status != null && typeof f.last_run_status !== 'string') ||
        (f.last_run_saved_count != null && !validCount(f.last_run_saved_count))) {
      throw new Error('Invalid feed');
    }
    feedIds.add(f.feed_id);
    feedNames.add(f.name);
    for (const field of ['last_run_at', 'last_success_at']) {
      const t = optionalInstant(f[field]);
      if (t != null && t > asOf + 60_000) throw new Error('Future feed timestamp');
    }
  }
  const runIds = new Set();
  for (const a of activity) {
    if (!object(a) || !Number.isSafeInteger(a.run_id) || a.run_id <= 0 ||
        runIds.has(a.run_id) || !feedNames.has(a.feed_name) ||
        typeof a.status !== 'string' || !a.status ||
        (a.http_status != null && (!Number.isInteger(a.http_status) || a.http_status < 100 || a.http_status > 599)) ||
        (a.saved_count != null && !validCount(a.saved_count))) {
      throw new Error('Invalid activity');
    }
    runIds.add(a.run_id);
    const requested = instant(a.requested_at);
    const finished = optionalInstant(a.finished_at);
    if (requested > asOf + 60_000 || (finished != null && (finished > asOf + 60_000 || finished < requested))) {
      throw new Error('Invalid activity timestamps');
    }
  }
  const results = feeds.map(f => {
    // Retention may be incomplete: counts below are observed, never assumed exhaustive.
    const recent = activity.filter(a => a.feed_name === f.name && a.finished_at != null &&
      instant(a.finished_at) >= asOf - DAY && instant(a.finished_at) <= asOf);
    const lastSuccess = optionalInstant(f.last_success_at);
    const counts = {
      completed: recent.length,
      successful: recent.filter(a => a.status === 'ok').length,
      http_403: recent.filter(a => a.http_status === 403).length,
      http_429: recent.filter(a => a.http_status === 429).length,
      saved: recent.reduce((sum, a) => sum + (a.saved_count ?? 0), 0)
    };
    const flags = [];
    if (f.active) {
      if (lastSuccess === null) flags.push('no_recorded_success');
      else if (lastSuccess < asOf - DAY) flags.push('last_success_over_24h_ago');
      if (counts.http_403 >= 3) flags.push('repeated_observed_http_403');
      else if (counts.http_403 > 0) flags.push('observed_http_403');
      if (counts.http_429 > 0) flags.push('observed_http_429');
      if (f.last_run_status === 'error') flags.push('last_run_error');
    }
    return {
      feed: f.name, active: f.active, last_run_status: f.last_run_status ?? null,
      last_success_at: f.last_success_at ?? null, last_run_saved_count: f.last_run_saved_count ?? null,
      observed_completed_24h: counts, flags
    };
  });
  results.sort((a, b) => a.feed.localeCompare(b.feed));
  return { as_of: snapshot.as_of, feeds: results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Requires one complete local snapshot path');
    const snapshot = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
    process.stdout.write(JSON.stringify(auditCollectorTelemetry(snapshot), null, 2) + '\n');
  } catch {
    // Do not dump potentially sensitive input, URLs, tokens or error strings.
    process.stderr.write('Offline collector audit failed: invalid or incomplete snapshot.\n');
    process.exitCode = 1;
  }
}
