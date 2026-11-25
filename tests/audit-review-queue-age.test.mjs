import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { auditReviewQueueAge } from '../scripts/audit-review-queue-age.mjs';

const as_of = '2026-11-22T06:00:00Z';
const make = (news_items = [], research_inbox = []) => ({
  as_of,
  expected_counts: { news_items: news_items.length, research_inbox: research_inbox.length },
  news_items,
  research_inbox,
});
const rec = (id, discovered_at, review_status = 'pending', extra = {}) => ({id, discovered_at, review_status, ...extra});

test('reports 7- and 14-day backlogs independently for both queues', () => {
  const snapshot = make([
    rec(1, '2026-11-13T06:00:00Z'),
    rec(2, '2026-11-01T06:00:00Z'),
    rec(3, '2026-11-01T06:00:00Z', 'approved'),
  ], [rec('4', '2026-11-11T06:00:00Z')]);
  const r = auditReviewQueueAge(snapshot);
  assert.equal(r.queues.news_items.pending, 2);
  assert.equal(r.queues.news_items.older_than_7_days, 2);
  assert.equal(r.queues.news_items.older_than_14_days, 1);
  assert.equal(r.queues.research_inbox.older_than_7_days, 1);
  assert.equal(r.queues.research_inbox.older_than_14_days, 0);
  assert.equal(r.basis, 'discovered_at_not_publication_date');
});

test('uses discovery time rather than publication time, never guesses missing dates', () => {
  const r = auditReviewQueueAge(make([rec(1, '2026-11-21T06:00:00Z', 'pending', {
    published_at: '2000-01-01', title: 'private', source_url: 'https://internal.example/path?token=secret',
  })]));
  assert.equal(r.queues.news_items.older_than_7_days, 0);
  assert.equal(JSON.stringify(r).includes('private'), false);
  assert.equal(JSON.stringify(r).includes('secret'), false);
});

test('flags pending missing and future discovery timestamps without aging them', () => {
  const r = auditReviewQueueAge(make([rec(1, null), rec(2, '2026-11-23T06:00:00Z')]));
  assert.equal(r.queues.news_items.pending_missing_discovery, 1);
  assert.equal(r.queues.news_items.pending_future_discovery, 1);
  assert.equal(r.queues.news_items.older_than_7_days, 0);
});

test('7-day and 14-day boundaries are strict older-than comparisons', () => {
  const r = auditReviewQueueAge(make([rec(1, '2026-11-15T06:00:00Z'), rec(2, '2026-11-08T06:00:00Z')]));
  assert.equal(r.queues.news_items.older_than_7_days, 1);
  assert.equal(r.queues.news_items.older_than_14_days, 0);
});

test('rejects incomplete exports rather than reporting misleading clearance', () => {
  const snapshot = make([rec(1, '2026-11-01T06:00:00Z')]);
  snapshot.expected_counts.news_items = 2;
  assert.throws(() => auditReviewQueueAge(snapshot), /Incomplete/);
});

test('rejects duplicate IDs, malformed timestamps and incomplete time-zone info', () => {
  assert.throws(() => auditReviewQueueAge(make([rec(1, as_of), rec('1', as_of)])), /repeated/);
  assert.throws(() => auditReviewQueueAge(make([rec(1, '2026-11-01T06:00:00')])), /timestamp/);
  assert.throws(() => auditReviewQueueAge(make([rec(1, 'bad')])), /timestamp/);
});

test('rejects invalid review state and record identifiers', () => {
  assert.throws(() => auditReviewQueueAge(make([rec(0, as_of)])), /ID/);
  assert.throws(() => auditReviewQueueAge(make([rec(1, as_of, '')])), /status/);
});

test('CLI prints only aggregate output and does not echo sensitive record fields', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ea-review-age-'));
  try {
    const path = join(dir, 'snapshot.json');
    writeFileSync(path, JSON.stringify(make([rec(1, as_of, 'pending', { title: 'confidential', source_url: 'https://example.com?password=SECRET' })])));
    const cli = resolve('scripts/audit-review-queue-age.mjs');
    const out = spawnSync(process.execPath, [cli, path], { encoding: 'utf8' });
    assert.equal(out.status, 0);
    assert.equal(JSON.parse(out.stdout).queues.news_items.pending, 1);
    assert.equal(out.stdout.includes('confidential'), false);
    assert.equal(out.stdout.includes('SECRET'), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
