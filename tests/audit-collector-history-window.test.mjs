import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditCollectorHistoryWindow } from '../scripts/audit-collector-history-window.mjs';
const asOf='2026-11-22T03:15:00Z';
const feed={feed_id:7,name:'Positive News',active:true};
const r=(status,requested_at,http_status)=>({feed_name:feed.name,status,requested_at,http_status});

test('shortened history yields observed failure count, not complete 24h coverage',()=>{
  const out=auditCollectorHistoryWindow({feeds:[feed],activity:[
    r('error','2026-11-22T02:00:00Z',403),r('pending','2026-11-22T03:00:00Z',null),
    r('error','2026-11-21T10:40:00Z',403)],asOf});
  assert.equal(out.feeds[0].errors_observed_in_window,2);
  assert.equal(out.feeds[0].http_403_errors_observed_in_window,2);
  assert.equal(out.feeds[0].history_reaches_window_start,false);
  assert.equal(out.feeds[0].streak_may_extend_before_snapshot,true);
});

test('older boundary record confirms reach only, not guaranteed completeness',()=>{
  const out=auditCollectorHistoryWindow({feeds:[feed],activity:[
    r('ok','2026-11-21T02:00:00Z',200),r('error','2026-11-22T02:00:00Z',403)],asOf});
  assert.equal(out.feeds[0].history_reaches_window_start,true);
  assert.equal(out.feeds[0].completed_observed_in_window,1);
  assert.equal(out.feeds[0].streak_may_extend_before_snapshot,false);
});

test('only IDs and counts exposed, no feed name or error content',()=>{
  const secret='private-marker';
  const f={...feed,name:secret};
  const out=auditCollectorHistoryWindow({feeds:[f],activity:[{feed_name:secret,status:'error',requested_at:asOf,error:secret,http_status:403}],asOf});
  assert.ok(!JSON.stringify(out).includes(secret));
});

test('reject invalid clock, duplicate IDs, and activity in future',()=>{
  assert.throws(()=>auditCollectorHistoryWindow({feeds:[feed],activity:[],asOf:'invalid'}));
  assert.throws(()=>auditCollectorHistoryWindow({feeds:[feed,feed],activity:[],asOf}));
  const out=auditCollectorHistoryWindow({feeds:[feed],activity:[r('error','2026-11-22T06:00:00Z',403)],asOf});
  assert.equal(out.invalid_activity_rows,1);
  assert.equal(out.feeds[0].errors_observed_in_window,0);
});

test('inactive feeds excluded and different window accepted',()=>{
  const out=auditCollectorHistoryWindow({feeds:[feed,{feed_id:9,name:'inactive',active:false}],activity:[r('ok','2026-11-22T03:00:00Z',200)],asOf,hours:2});
  assert.equal(out.feeds.length,1);
  assert.equal(out.window_hours,2);
});
