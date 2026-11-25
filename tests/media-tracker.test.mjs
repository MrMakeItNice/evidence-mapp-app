import test from 'node:test';
import assert from 'node:assert/strict';
import {readMediaFeed,selectMedia,pacificDay} from '../media-tracker.mjs';
// Synthetic fixtures only. Coordinates and publishers are NOT real geographic evidence.
const loc=(kind='publisher')=>({kind,lat:12,lon:34,label:'Fixture City',basis:'Synthetic test only',source_url:'https://example.invalid/location',review_status:'verified'});
const row=(id,extra={})=>({id,original_url:'https://example.invalid/'+id,outlet:'Fixture A',headline_original:'Water project',language:'en',attribution_url:'https://example.invalid/terms',publication_status:'published',editorial_status:'cleared_for_public_index',published_at:'2026-11-25T09:00:00Z',tone:'positive',tone_rationale:'Fixture only',publisher_location:loc(),coverage_group:'water',...extra});
const feed=(reports)=>readMediaFeed({schema_version:1,kind:'public_media_reports',checked_at:'2026-11-25T10:00:00Z',coverage_note:'Synthetic limited coverage',reports});
const view=(reports,opts={})=>selectMedia(feed(reports),{now:new Date('2026-11-25T10:00:00Z'),...opts});
test('Pacific date, all tone categories, overlapping pins and distinct outlets',()=>{
  assert.equal(pacificDay('2026-11-25T07:59:59Z'),'2026-11-24');
  const v=view([row('a'),row('b',{tone:'negative',outlet:'Fixture B'}),row('c',{tone:'neutral'}),row('d',{tone:'mixed'}),row('e',{tone:'uncertain'}),row('old',{published_at:'2026-11-25T07:59:59Z'})]);
  assert.deepEqual(v.counts,{positive:1,negative:1,neutral:1,mixed:1,uncertain:1});
  assert.equal(v.clusters.length,1);assert.equal(v.clusters[0].stories.length,5);
  assert.deepEqual(v.outlets,[['Fixture A',4],['Fixture B',1]]);
});
test('pending/private records withheld, private fields never projected',()=>{
  const f=feed([row('a',{human_notes:'private'}),row('b',{editorial_status:'pending'}),row('c',{publication_status:'private'})]);
  assert.equal(f.reports.length,1);assert.equal('human_notes' in f.reports[0],false);
});
test('publisher vs event coordinates, missing location and provenance',()=>{
  const records=[row('a',{event_location:{...loc('event'),lat:55}}),row('b',{publisher_location:null}),row('c',{publisher_location:{...loc(),source_url:null}})];
  assert.equal(view(records).clusters[0].lat,12);assert.equal(view(records).unlocated.length,2);
  assert.equal(view(records,{mode:'event'}).clusters[0].lat,55);
  assert.equal(view(records,{mode:'event'}).unlocated.length,2);
});
test('multilingual search, conflicting accounts retained, reset restores today',()=>{
  const rows=[row('a',{headline_original:'Agua potable',language:'es',headline_translated:'Drinking water',translation_attribution:'Fixture translation',publisher_country:'Fixture country',tone:'positive'}),row('b',{headline_original:'Agua potable',language:'es',outlet:'Fixture B',tone:'negative'}),row('c',{published_at:null,headline_original:'Agua potable',language:'es'}),row('d',{published_at:'2026-11-24T09:00:00Z',headline_original:'Agua potable',language:'es'})];
  const found=view(rows,{query:'AGUA',language:'es'});
  assert.equal(found.reports.length,4);assert.equal(found.undated.length,1);
  assert.equal(found.coverageGroups[0][1].length,4);
  assert.equal(view(rows,{query:'drinking'}).reports.length,1);
  assert.equal(view(rows).reports.length,2);
});
test('exact repeat only; syndication attribution preserved for review',()=>{
  const a=row('a',{syndication_id:'wire-fixture'});
  const b=row('b',{syndication_id:'wire-fixture',outlet:'Fixture B'});
  assert.equal(feed([a,a,b]).reports.length,2);
  assert.throws(()=>feed([a,{...a,headline_original:'Different'}]),/identity/);
});
test('unavailable feed, unsafe URL, invalid timestamp and uncertain tone',()=>{
  assert.throws(()=>readMediaFeed(null),/unavailable/);
  assert.throws(()=>feed([row('a',{original_url:'https://user:pass@example.invalid/'})]),/Invalid/);
  const v=view([row('a',{published_at:'2026-02-30T12:00:00Z',tone_rationale:''})],{query:'water'});
  assert.equal(v.undated.length,1);assert.equal(v.counts.uncertain,1);
});
