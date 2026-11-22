import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditFeedFailureStreaks } from '../scripts/audit-feed-failure-streaks.mjs';

const asOf = '2026-11-22T02:30:00Z';
const feed = {feed_id: 1, name: 'Positive News', active: true, last_success_at: '2026-11-11T16:46:00Z'};
const activity = [
  {feed_name:'Positive News', status:'error', http_status:403, requested_at:'2026-11-22T01:50:00Z', error:'secret credential'},
  {feed_name:'Positive News', status:'pending', requested_at:'2026-11-22T02:25:00Z', error:'another secret'},
  {feed_name:'Positive News', status:'error', http_status:403, requested_at:'2026-11-22T01:15:00Z'},
  {feed_name:'Positive News', status:'ok', http_status:200, requested_at:'2026-11-11T16:46:00Z', saved_count:0}
];

test('pending latest poll does not erase completed 403 failure streak', () => {
  const result = auditFeedFailureStreaks({feeds:[feed],activity,asOf});
  assert.deepEqual(result.feeds[0], {
    feed_id:1, most_recent_run_pending:true, last_completed_status:'error',
    last_completed_http_status:403,consecutive_errors:2,success_freshness:'stale_over_24h'
  });
});

test('zero saved articles remains a successful completed poll', () => {
  const f={feed_id:2,name:'BBC',active:true,last_success_at:'2026-11-22T02:00:00Z'};
  const r=auditFeedFailureStreaks({feeds:[f],activity:[{feed_name:'BBC',status:'ok',http_status:200,saved_count:0,requested_at:'2026-11-22T02:00:00Z'}],asOf});
  assert.equal(r.feeds[0].last_completed_status,'ok');
  assert.equal(r.feeds[0].consecutive_errors,0);
  assert.equal(r.feeds[0].success_freshness,'recent_24h');
});

test('records are time-ordered, and failures are counted only until first success',()=>{
  const r=auditFeedFailureStreaks({feeds:[feed],activity:[activity[3],activity[0],activity[2]],asOf});
  assert.equal(r.feeds[0].consecutive_errors,2);
  assert.equal(r.feeds[0].most_recent_run_pending,false);
});

test('feed names, errors and source URLs do not leak into output',()=>{
  const secret='token-private-marker';
  const f={feed_id:3,name:'Secret '+secret,active:true};
  const r=auditFeedFailureStreaks({feeds:[f],activity:[{feed_name:f.name,status:'error',requested_at:asOf,http_status:403,error:secret,source_url:'https://example.org/'+secret}],asOf});
  assert.equal(r.feeds[0].success_freshness,'missing');
  assert.ok(!JSON.stringify(r).includes(secret));
  assert.ok(!JSON.stringify(r).includes('https:'));
});

test('inactive feeds and unrelated activity are excluded',()=>{
  const inactive={feed_id:8,name:'Disabled',active:false};
  const r=auditFeedFailureStreaks({feeds:[feed,inactive],activity:[{feed_name:'Unknown',status:'error',requested_at:asOf},...activity],asOf});
  assert.equal(r.active_feed_count,1);
  assert.equal(r.feeds[0].feed_id,1);
});

test('invalid and future-dated activity rows are not treated as completed runs',()=>{
  const r=auditFeedFailureStreaks({feeds:[feed],activity:[{feed_name:'Positive News',status:'error',requested_at:'2026-11-22T03:35:00Z'}, {feed_name:'Positive News',status:'error',requested_at:'invalid'}],asOf});
  assert.equal(r.invalid_activity_rows,2);
  assert.equal(r.feeds[0].last_completed_status,'none');
});

test('missing or future success timestamps are distinguished from stale success',()=>{
  const f1={feed_id:4,name:'No success',active:true,last_success_at:null};
  const f2={feed_id:5,name:'Future',active:true,last_success_at:'2026-11-23T02:00:00Z'};
  const r=auditFeedFailureStreaks({feeds:[f2,f1],activity:[],asOf});
  assert.deepEqual(r.feeds.map(x=>x.success_freshness),['missing','future']);
});

test('non-array input, duplicate feed IDs/names and invalid clock are rejected',()=>{
  assert.throws(()=>auditFeedFailureStreaks({feeds:{},asOf}));
  assert.throws(()=>auditFeedFailureStreaks({feeds:[feed,feed],activity:[],asOf}));
  assert.throws(()=>auditFeedFailureStreaks({feeds:[feed,{...feed,feed_id:2}],activity:[],asOf}));
  assert.throws(()=>auditFeedFailureStreaks({feeds:[],activity:[],asOf:'bad-date'}));
});
