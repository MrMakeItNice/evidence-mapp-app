import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCollectorTelemetry } from '../scripts/audit-collector-telemetry.mjs';

const snapshot = () => ({
  as_of: '2026-11-22T14:05:00Z',
  expected_counts: { agent_control_feeds: 1, agent_control_activity: 1 },
  agent_control_feeds: [{
    feed_id: 7, name: 'Positive News', active: true, last_run_status: 'ok',
    last_run_at: '2026-11-22T13:00:00Z', last_success_at: '2026-11-22T13:01:00Z',
    last_run_saved_count: 0, last_error: 'secret should never be exposed'
  }],
  agent_control_activity: [{
    run_id: 1, feed_name: 'Positive News', status: 'ok', http_status: 200,
    saved_count: 0, requested_at: '2026-11-22T13:00:00Z',
    finished_at: '2026-11-22T13:01:00Z',
    error: 'secret should never be exposed', source_url: 'https://secret.example/private'
  }]
});
const check = s => auditCollectorTelemetry(s).feeds[0];

test('complete healthy snapshot reports observed successes without flags', () => {
  const f = check(snapshot());
  assert.equal(f.observed_completed_24h.successful, 1);
  assert.equal(f.observed_completed_24h.completed, 1);
  assert.deepEqual(f.flags, []);
});
test('three observed 403 responses flag repeated access failure, not truth claims', () => {
  const s = snapshot();
  s.agent_control_activity = [1,2,3].map((run_id) => ({
    ...s.agent_control_activity[0], run_id, status: 'error', http_status: 403
  }));
  s.expected_counts.agent_control_activity = 3;
  const f = check(s);
  assert.equal(f.observed_completed_24h.http_403, 3);
  assert.ok(f.flags.includes('repeated_observed_http_403'));
});
test('single 403 incident is not classified as a repeated failure', () => {
  const s = snapshot();
  s.agent_control_activity[0].status = 'error';
  s.agent_control_activity[0].http_status = 403;
  assert.ok(check(s).flags.includes('observed_http_403'));
  assert.ok(!check(s).flags.includes('repeated_observed_http_403'));
});
test('single 429 is flagged without labeling the entire feed failed', () => {
  const s = snapshot();
  s.agent_control_activity[0].status = 'error';
  s.agent_control_activity[0].http_status = 429;
  assert.deepEqual(check(s).flags, ['observed_http_429', 'http_429_without_later_observed_success']);
});
test('a pending last run does not mean a failed completed run', () => {
  const s = snapshot();
  s.agent_control_feeds[0].last_run_status = 'pending';
  assert.deepEqual(check(s).flags, []);
});
test('zero records saved on a successful run is not flagged as failure', () => {
  const s = snapshot();
  assert.equal(check(s).last_run_saved_count, 0);
  assert.deepEqual(check(s).flags, []);
});
test('stale successful collection is distinguished from a recent 200 response', () => {
  const s = snapshot();
  s.agent_control_feeds[0].last_success_at = '2026-11-11T12:00:00Z';
  assert.ok(check(s).flags.includes('last_success_over_24h_ago'));
});
test('never-successful active feed has a separate flag', () => {
  const s = snapshot();
  s.agent_control_feeds[0].last_success_at = null;
  assert.ok(check(s).flags.includes('no_recorded_success'));
});
test('incomplete snapshots are rejected instead of inferring total history', () => {
  const s = snapshot();
  s.expected_counts.agent_control_activity = 2;
  assert.throws(() => check(s), /Incomplete snapshot/);
});
test('duplicate run IDs are rejected', () => {
  const s = snapshot();
  s.agent_control_activity.push({ ...s.agent_control_activity[0] });
  s.expected_counts.agent_control_activity = 2;
  assert.throws(() => check(s), /Invalid activity/);
});
test('an unknown feed reference is rejected', () => {
  const s = snapshot();
  s.agent_control_activity[0].feed_name = 'unrecognized';
  assert.throws(() => check(s), /Invalid activity/);
});
test('future completion timestamps are rejected', () => {
  const s = snapshot();
  s.agent_control_activity[0].finished_at = '2026-11-23T13:01:00Z';
  assert.throws(() => check(s), /Invalid activity timestamps/);
});
test('impossible Gregorian calendar dates are rejected', () => {
  const s = snapshot();
  s.as_of = '2026-02-30T14:05:00Z';
  assert.throws(() => check(s), /Invalid timestamp/);
});
test('private error text and raw URLs never appear in JSON output', () => {
  const output = JSON.stringify(auditCollectorTelemetry(snapshot()));
  assert.ok(!output.includes('secret should never be exposed'));
  assert.ok(!output.includes('https://secret.example/private'));
});
test('inactive feed does not generate remediation alerts', () => {
  const s = snapshot();
  s.agent_control_feeds[0].active = false;
  s.agent_control_feeds[0].last_success_at = null;
  s.agent_control_feeds[0].last_run_status = 'error';
  s.agent_control_activity[0].http_status = 403;
  assert.deepEqual(check(s).flags, []);
});

test('HTTP 403 marked ok is not credited as successful collection', () => {
  const s = snapshot();
  s.agent_control_activity[0].status = 'ok';
  s.agent_control_activity[0].http_status = 403;
  const f = check(s);
  assert.equal(f.observed_completed_24h.successful, 0);
  assert.equal(f.observed_completed_24h.http_403, 1);
  assert.ok(f.flags.includes('status_ok_with_http_error'));
});

test('completed activity marked pending is flagged for telemetry reconciliation', () => {
  const s = snapshot();
  s.agent_control_activity[0].status = 'pending';
  const f = check(s);
  assert.equal(f.observed_completed_24h.successful, 0);
  assert.ok(f.flags.includes('completed_run_still_pending'));
  assert.ok(!f.flags.includes('last_run_error'));
});

test('429 followed by later successful completion is distinguished from an active access problem', () => {
  const s = snapshot();
  s.agent_control_activity.push({
    ...s.agent_control_activity[0], run_id: 2, status: 'error', http_status: 429,
    requested_at: '2026-11-22T12:10:00Z', finished_at: '2026-11-22T12:11:00Z'
  });
  s.expected_counts.agent_control_activity = 2;
  const f = check(s);
  assert.equal(f.observed_completed_24h.http_429, 1);
  assert.equal(f.observed_completed_24h.successful, 1);
  assert.ok(f.flags.includes('http_429_followed_by_observed_success'));
  assert.ok(!f.flags.includes('http_429_without_later_observed_success'));
});

test('a healthy run before the latest 429 does not prove recovery', () => {
  const s = snapshot();
  s.agent_control_activity.push({
    ...s.agent_control_activity[0], run_id: 2, status: 'error', http_status: 429,
    requested_at: '2026-11-22T13:30:00Z', finished_at: '2026-11-22T13:31:00Z'
  });
  s.expected_counts.agent_control_activity = 2;
  const f = check(s);
  assert.ok(f.flags.includes('http_429_without_later_observed_success'));
  assert.ok(!f.flags.includes('http_429_followed_by_observed_success'));
});

test('success after an earlier 429 but before a later 429 is not sufficient', () => {
  const s = snapshot();
  s.agent_control_activity.push({
    ...s.agent_control_activity[0], run_id: 2, status: 'error', http_status: 429,
    requested_at: '2026-11-22T12:00:00Z', finished_at: '2026-11-22T12:01:00Z'
  }, {
    ...s.agent_control_activity[0], run_id: 3, status: 'error', http_status: 429,
    requested_at: '2026-11-22T13:30:00Z', finished_at: '2026-11-22T13:31:00Z'
  });
  s.expected_counts.agent_control_activity = 3;
  const f = check(s);
  assert.equal(f.observed_completed_24h.http_429, 2);
  assert.ok(f.flags.includes('http_429_without_later_observed_success'));
});
