/**
 * Offline coverage check for a rolling collector activity snapshot.
 * A count within a time window is only an OBSERVED count unless the supplied
 * activity actually reaches the start of that window. An empty or shortened
 * snapshot cannot establish that no earlier failures occurred.
 * No I/O, network, database writes or source-content output.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const HOUR_MS = 3_600_000;
const validTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

export function auditCollectorHistoryWindow({ feeds = [], activity = [], asOf, hours = 24 } = {}) {
  if (!Array.isArray(feeds) || !Array.isArray(activity) || !validTime(asOf) ||
      !Number.isInteger(hours) || hours < 1 || hours > 168) {
    throw new TypeError('Supply feed/activity arrays, ISO clock, and 1–168 hour window.');
  }
  const clock = Date.parse(asOf);
  const cutoff = clock - hours * HOUR_MS;
  const names = new Set(), ids = new Set();
  for (const feed of feeds) {
    if (!feed || !Number.isSafeInteger(feed.feed_id) || feed.feed_id < 1 ||
        typeof feed.name !== 'string' || !feed.name.trim() ||
        ids.has(feed.feed_id) || names.has(feed.name)) {
      throw new TypeError('Unique valid feed IDs and names required.');
    }
    names.add(feed.name);
    ids.add(feed.feed_id);
  }
  const grouped = new Map();
  let invalid_activity_rows = 0;
  for (const run of activity) {
    if (!run || !names.has(run.feed_name)) continue;
    if (!validTime(run.requested_at) ||
        !['ok', 'error', 'pending'].includes(run.status) ||
        Date.parse(run.requested_at) > clock + 60_000) {
      invalid_activity_rows++;
      continue;
    }
    const entries = grouped.get(run.feed_name) ?? [];
    entries.push({time:Date.parse(run.requested_at),status:run.status,http:run.http_status});
    grouped.set(run.feed_name, entries);
  }
  const results = [];
  for (const feed of feeds) {
    if (feed.active !== true) continue;
    const runs = (grouped.get(feed.name) ?? []).sort((a,b)=>b.time-a.time);
    const recent = runs.filter(run => run.time >= cutoff && run.time <= clock);
    const completed = recent.filter(run => run.status !== 'pending');
    const errors = completed.filter(run => run.status === 'error');
    const has_boundary_record = runs.some(run => run.time <= cutoff);
    let observed_streak = 0;
    for (const run of runs) {
      if (run.status === 'pending') continue;
      if (run.status !== 'error') break;
      observed_streak++;
    }
    results.push({
      feed_id:feed.feed_id,
      retained_run_count:runs.length,
      completed_observed_in_window:completed.length,
      errors_observed_in_window:errors.length,
      http_403_errors_observed_in_window:errors.filter(r=>r.http===403).length,
      history_reaches_window_start:has_boundary_record,
      observed_consecutive_errors:observed_streak,
      streak_may_extend_before_snapshot:observed_streak > 0 && !runs.some(r=>r.status==='ok'),
    });
  }
  results.sort((a,b)=>a.feed_id-b.feed_id);
  return {
    as_of:asOf, window_hours:hours, invalid_activity_rows,
    feeds:results, review_only:true,
    limitation:'All counts are observed in the supplied snapshot. A missing boundary record means historical completeness cannot be established; even a boundary record alone cannot prove the snapshot has no gaps. Never claim these counts are exhaustive without independent retention/cadence verification.'
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('snapshot required');
    const snapshot = JSON.parse(await readFile(process.argv[2], 'utf8'));
    process.stdout.write(JSON.stringify(auditCollectorHistoryWindow(snapshot), null, 2) + '\n');
  } catch {
    process.stderr.write('Unable to audit local collector snapshot.\n');
    process.exitCode = 2;
  }
}
