/**
 * Offline collector-health audit. Given an explicitly supplied snapshot of
 * agent_control_feeds and agent_control_activity plus a clock, distinguish
 * pending dispatches from the last completed outcome and count recent failures.
 * Never reads Supabase, makes requests, retries feeds, or publishes anything.
 * Output is limited to feed IDs, timestamp/status diagnostics and HTTP codes;
 * it never repeats raw errors, feed names, URLs, or response bodies.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const HOUR = 3_600_000;
const validId = v => Number.isSafeInteger(v) && v > 0;
const validDate = v => typeof v === 'string' && Number.isFinite(Date.parse(v));
const validStatus = v => v === 'ok' || v === 'error' || v === 'pending';

export function auditFeedFailureStreaks({ feeds = [], activity = [], asOf } = {}) {
  if (!Array.isArray(feeds) || !Array.isArray(activity) || !validDate(asOf)) {
    throw new TypeError('Supply feed and activity arrays and an explicit ISO timestamp.');
  }
  const clock = Date.parse(asOf);
  const feedNames = new Set();
  const feedIds = new Set();
  for (const feed of feeds) {
    if (!feed || !validId(feed.feed_id) || typeof feed.name !== 'string' ||
        !feed.name.trim() || feedIds.has(feed.feed_id) || feedNames.has(feed.name)) {
      throw new TypeError('Feeds require unique positive IDs and nonempty names.');
    }
    feedNames.add(feed.name);
    feedIds.add(feed.feed_id);
  }

  const activityByName = new Map();
  let invalid_activity_rows = 0;
  for (const record of activity) {
    if (!record || typeof record.feed_name !== 'string' ||
        !validStatus(record.status) || !validDate(record.requested_at)) {
      invalid_activity_rows++;
      continue;
    }
    const ms = Date.parse(record.requested_at);
    if (ms > clock + 60_000) { invalid_activity_rows++; continue; }
    if (!feedNames.has(record.feed_name)) continue; // Unrelated feeds are out of scope.
    const existing = activityByName.get(record.feed_name) ?? [];
    existing.push({ ms, status: record.status,
      http: Number.isInteger(record.http_status) && record.http_status >= 100 && record.http_status <= 599
        ? record.http_status : null });
    activityByName.set(record.feed_name, existing);
  }

  const diagnostics = [];
  for (const feed of feeds) {
    if (feed.active !== true) continue;
    const runs = (activityByName.get(feed.name) ?? []).sort((a, b) => b.ms - a.ms);
    const lastCompleted = runs.find(r => r.status !== 'pending');
    let consecutiveErrors = 0;
    for (const r of runs) {
      if (r.status === 'pending') continue;
      if (r.status !== 'error') break;
      consecutiveErrors++;
    }
    const lastSuccess = validDate(feed.last_success_at) ? Date.parse(feed.last_success_at) : null;
    const successFreshness = lastSuccess === null ? 'missing' :
      lastSuccess > clock + 60_000 ? 'future' :
      clock - lastSuccess > 24 * HOUR ? 'stale_over_24h' : 'recent_24h';
    diagnostics.push({
      feed_id: feed.feed_id,
      most_recent_run_pending: runs[0]?.status === 'pending',
      last_completed_status: lastCompleted?.status ?? 'none',
      last_completed_http_status: lastCompleted?.http ?? null,
      consecutive_errors: consecutiveErrors,
      success_freshness: successFreshness
    });
  }
  diagnostics.sort((a, b) => a.feed_id - b.feed_id);
  return {
    as_of: asOf,
    active_feed_count: diagnostics.length,
    invalid_activity_rows,
    feeds: diagnostics,
    review_only: true,
    limitation: 'HTTP errors and stale successes are operational signals, not proof of an access challenge, failed research, or factual inaccuracy.'
  };
}

// Optional offline CLI: node scripts/audit-feed-failure-streaks.mjs snapshot.json
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) {
    process.stderr.write('Expected one local JSON snapshot path.\n');
    process.exitCode = 2;
  } else {
    try {
      const snapshot = JSON.parse(await readFile(process.argv[2], 'utf8'));
      process.stdout.write(JSON.stringify(auditFeedFailureStreaks(snapshot), null, 2) + '\n');
    } catch {
      process.stderr.write('Unable to audit local snapshot. Check JSON and required fields.\n');
      process.exitCode = 2;
    }
  }
}
