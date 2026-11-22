import test from 'node:test';
import assert from 'node:assert/strict';
import { auditWatchInboxCoverage } from '../scripts/audit-watch-inbox-coverage.mjs';

test('empty collections are valid and have no inferred relationships', () => {
  const result = auditWatchInboxCoverage();
  assert.equal(result.active_watch_count, 0);
  assert.deepEqual(result.active_watches_with_no_inbox_ids, []);
});

test('flags active watches with no linked inbox without treating that as evidence absence', () => {
  const result = auditWatchInboxCoverage({researchWatches:[{id:2,active:true},{id:1,active:true},{id:3,active:false}]});
  assert.deepEqual(result.active_watches_with_no_inbox_ids,[1,2]);
  assert.match(result.assessment,/not proof of no research/);
});

test('groups pending and nonpending inbox records by active watch', () => {
  const result = auditWatchInboxCoverage({
    researchWatches:[{id:1,active:true},{id:2,active:true}],
    researchInbox:[{id:20,watch_topic_id:1,review_status:'pending'},
      {id:21,watch_topic_id:1,review_status:'approved'},
      {id:22,watch_topic_id:2,review_status:'pending'}]
  });
  assert.deepEqual(result.active_watches_with_only_pending_inbox_ids,[2]);
  assert.deepEqual(result.active_watch_inbox_counts,[
    {watch_id:1,inbox_records:2,pending_records:1},
    {watch_id:2,inbox_records:1,pending_records:1}
  ]);
});

test('reports unassigned, missing-watch and inactive-watch links independently', () => {
  const result = auditWatchInboxCoverage({
    researchWatches:[{id:1,active:true},{id:2,active:false}],
    researchInbox:[{id:5,watch_topic_id:null},{id:6,watch_topic_id:99},
      {id:7,watch_topic_id:2},{id:8}]
  });
  assert.deepEqual(result.unassigned_inbox_ids,[5,8]);
  assert.deepEqual(result.unknown_watch_links,[{inbox_id:6,watch_id:99}]);
  assert.deepEqual(result.inbox_ids_linked_to_inactive_watches,[7]);
});

test('rejects invalid watch foreign keys rather than guessing', () => {
  assert.throws(()=>auditWatchInboxCoverage({researchInbox:[{id:1,watch_topic_id:'1'}]}),/positive safe integer/);
});

test('rejects duplicate identifiers to prevent misleading coverage counts', () => {
  assert.throws(()=>auditWatchInboxCoverage({researchWatches:[{id:1},{id:1}]}),/duplicate ID/);
  assert.throws(()=>auditWatchInboxCoverage({researchInbox:[{id:1},{id:1}]}),/duplicate ID/);
});

test('rejects malformed input shapes', () => {
  assert.throws(()=>auditWatchInboxCoverage({researchWatches:{}}),/arrays/);
  assert.throws(()=>auditWatchInboxCoverage({researchInbox:[null]}),/object/);
});

test('is nonmutating and output never includes source URLs, titles, or sensitive notes', () => {
  const researchWatches = Object.freeze([Object.freeze({id:1,active:true,name:'Private watch',search_query:'top secret'})]);
  const researchInbox = Object.freeze([Object.freeze({id:3,watch_topic_id:1,review_status:'pending',source_url:'https://secret.invalid/token=PRIVATE',title:'PRIVATE',evidence_notes:'PRIVATE'})]);
  const result = auditWatchInboxCoverage({researchWatches,researchInbox});
  assert.equal(result.active_watch_count,1);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|secret\.invalid|Private watch|top secret/);
});
