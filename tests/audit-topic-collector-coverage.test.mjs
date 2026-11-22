import test from 'node:test';
import assert from 'node:assert/strict';
import { auditTopicCollectorCoverage as audit } from '../scripts/audit-topic-collector-coverage.mjs';

test('separates populated, collector-backed empty, and no-collector empty topics', () => {
  const result = audit({
    topics: [{ id: 3, active: true }, { id: 1, active: true }, { id: 2, active: true }],
    items: [{ topic_id: 1 }, { topic_id: 1 }],
    feeds: [{ topic_id: 2, active: true }, { topic_id: 3, active: false }]
  });
  assert.deepEqual(result.topic_rows.map(r => [r.topic_id, r.classification]), [
    [1, 'has_items'], [2, 'empty_with_active_feed'], [3, 'empty_without_active_feed']
  ]);
  assert.deepEqual(result.summary, {
    has_items: 1, empty_with_active_feed: 1, empty_without_active_feed: 1,
    unassigned_items: 0, unassigned_active_feeds: 0
  });
});

test('counts only active feeds and excludes inactive topics from results', () => {
  const result = audit({
    topics: [{ id: 1, active: false }, { id: 2, active: true }],
    items: [{ topic_id: 1 }],
    feeds: [{ topic_id: 2, active: false }, { topic_id: 2, active: true }, { topic_id: 2, active: true }]
  });
  assert.equal(result.scope.active_topics, 1);
  assert.deepEqual(result.topic_rows[0], {
    topic_id: 2, item_count: 0, active_feed_count: 2, classification: 'empty_with_active_feed'
  });
});

test('tracks unassigned and unknown topic references without silently reassigning', () => {
  const result = audit({
    topics: [{ id: 4, active: true }],
    items: [{ topic_id: null }, { topic_id: 99 }, { topic_id: 99 }, { topic_id: 19 }],
    feeds: [{ topic_id: undefined, active: true }, { topic_id: 29, active: true }]
  });
  assert.equal(result.summary.unassigned_items, 1);
  assert.equal(result.summary.unassigned_active_feeds, 1);
  assert.deepEqual(result.unknown_item_topic_ids, [19, 99]);
  assert.deepEqual(result.unknown_active_feed_topic_ids, [29]);
});

test('rejects incomplete snapshots, duplicate topic IDs and unsafe IDs', () => {
  assert.throws(() => audit({ topics: [], items: [] }));
  assert.throws(() => audit({ topics: [{id: 1, active: true}, {id: 1, active: false}], items: [], feeds: [] }));
  assert.throws(() => audit({ topics: [{id: -1, active: true}], items: [], feeds: [] }));
  assert.throws(() => audit({ topics: [], items: [{ topic_id: '3' }], feeds: [] }));
  assert.throws(() => audit({ topics: [], items: [], feeds: [{topic_id:1, active:'yes'}] }));
});

test('never echoes source URLs or personal fields and leaves input untouched', () => {
  const input = {
    topics: [{ id: 5, active: true, title: 'private-title' }],
    items: [{ topic_id: 5, source_url: 'https://secret.example/?token=private-secret', human_notes: 'confidential' }],
    feeds: [{ topic_id: 5, active: true, url: 'https://feed.example/private' }]
  };
  const before = JSON.stringify(input);
  const output = JSON.stringify(audit(input));
  assert.equal(JSON.stringify(input), before);
  assert.doesNotMatch(output, /private|secret|confidential|https/);
});

test('empty topic with configured collector is not classified as a collector failure', () => {
  const result = audit({
    topics: [{ id: 7, active: true }],
    items: [],
    feeds: [{ topic_id: 7, active: true, last_success_at: null }]
  });
  assert.equal(result.topic_rows[0].classification, 'empty_with_active_feed');
  assert.doesNotMatch(JSON.stringify(result), /failure|broken|stale|outage/);
});

test('supports safely empty input and deterministic ordering', () => {
  const result = audit({topics: [], items: [], feeds: []});
  assert.deepEqual(result.topic_rows, []);
  assert.equal(result.scope.active_topics, 0);
});
