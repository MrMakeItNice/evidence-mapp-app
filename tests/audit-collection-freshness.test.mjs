import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditCollectionFreshness } from '../scripts/audit-collection-freshness.mjs';
const now = '2026-11-21T13:23:00Z';

test('separates stale, never-checked, fresh, inactive and future research watches', () => {
  const watches = Object.freeze([
    {id:1,active:true,last_checked_at:'2026-11-02T16:22:10Z'},
    {id:2,active:true,last_checked_at:null},
    {id:3,active:true,last_checked_at:'2026-11-21T13:22:00Z'},
    {id:4,active:false,last_checked_at:null},
    {id:5,active:true,last_checked_at:'2026-12-01T00:00:00Z'}
  ]);
  const result = auditCollectionFreshness({researchWatches:watches,asOf:now});
  assert.deepEqual(result.research_watches.stale_ids,[1]);
  assert.deepEqual(result.research_watches.missing_ids,[2]);
  assert.deepEqual(result.research_watches.fresh_ids,[3]);
  assert.deepEqual(result.research_watches.future_ids,[5]);
  assert.equal(result.research_watches.active,4);
  assert.equal(watches[0].last_checked_at,'2026-11-02T16:22:10Z');
});

test('all null news-watch timestamps are uncollected, not successfully polled', () => {
  const r=auditCollectionFreshness({newsWatches:[{id:1,active:true,last_collected_at:null},{id:2,active:true,last_collected_at:''}],asOf:now});
  assert.deepEqual(r.news_watches.missing_ids,[1,2]);
  assert.deepEqual(r.news_watches.fresh_ids,[]);
});

test('last run error outweighs old success; successful zero saved records is not failure', () => {
  const r=auditCollectionFreshness({asOf:now,feeds:[
    {name:'Positive News',active:true,last_run_status:'error',last_run_at:'2026-11-21T13:00:00Z',last_success_at:'2026-11-11T16:46:00Z',last_error:'secret-token'},
    {name:'World News',active:true,last_run_status:'ok',last_run_at:'2026-11-21T13:10:00Z',last_success_at:'2026-11-21T13:11:00Z',last_run_saved_count:0},
    {name:'Queued',active:true,last_run_status:'pending',last_run_at:'2026-11-21T13:20:00Z'},
    {name:'Old success',active:true,last_run_status:'ok',last_run_at:'2026-11-20T13:00:00Z',last_success_at:'2026-11-20T13:00:00Z'}
  ]});
  assert.deepEqual(r.feeds.error_names,['Positive News']);
  assert.deepEqual(r.feeds.healthy_names,['World News']);
  assert.deepEqual(r.feeds.pending_names,['Queued']);
  assert.deepEqual(r.feeds.stale_success_names,['Old success']);
  assert.equal(JSON.stringify(r).includes('secret-token'),false);
});

test('rejects missing clock and malformed data, and sanitizes malicious feed names', () => {
  assert.throws(()=>auditCollectionFreshness({}),TypeError);
  assert.throws(()=>auditCollectionFreshness({asOf:now,feeds:{}}),TypeError);
  const r=auditCollectionFreshness({asOf:now,feeds:[{active:true,name:'bad\nfeed',last_run_status:'error',last_run_at:now}]});
  assert.deepEqual(r.feeds.error_names,['(unnamed feed)']);
});
