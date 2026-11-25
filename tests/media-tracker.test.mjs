import test from 'node:test';
import assert from 'node:assert/strict';
import {readMediaFeed,selectMedia,pacificDay,validatePublicMediaExport,pacificRefreshWindow,mediaFeedFreshness} from '../media-tracker.mjs';
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

const rawExport=reports=>({schema_version:1,kind:'public_media_reports',checked_at:'2026-11-25T10:00:00Z',coverage_note:'Synthetic staging sample',reports});
test('producer preflight rejects uncleared raw bytes even though browser filters them',()=>{
  for(const r of [row('a',{editorial_status:'pending'}),row('a',{publication_status:'private'}),row('a',{human_notes:'private fixture'})])
    assert.throws(()=>validatePublicMediaExport(rawExport([r])),/Non-cleared|Unexpected/);
  assert.throws(()=>validatePublicMediaExport({...rawExport([]),internal_queue:[]}),/Unexpected/);
  assert.throws(()=>validatePublicMediaExport(rawExport([row('a',{publisher_location:{...loc(),private_note:'fixture'}})])),/Unexpected/);
});
test('producer preflight rejects invalid optional provenance and duplicate rows',()=>{
  for(const r of [row('a',{publisher_location:{...loc(),review_status:'pending'}}),row('a',{event_location:loc()}),row('a',{published_at:'2026-02-30T12:00:00Z'}),row('a',{correction_url:'http://example.invalid'}),row('a',{headline_translated:'Agua'}),row('a',{tone_rationale:''}),row('a',{topics:[{private:'fixture'}]})])
    assert.throws(()=>validatePublicMediaExport(rawExport([r])));
  assert.throws(()=>validatePublicMediaExport(rawExport([row('a'),row('a')])),/Duplicate/);
});
test('producer preflight retains cleared distinct perspectives and honest missing fields',()=>{
  const a=row('a',{syndication_id:'fixture-wire'});
  const b=row('b',{syndication_id:'fixture-wire',outlet:'Fixture B',tone:'mixed',publisher_location:null,published_at:null});
  const f=validatePublicMediaExport(rawExport([a,b]));
  assert.equal(f.reports.length,2);
  assert.equal(f.reports[1].publisher_location,null);
  assert.equal(f.reports[1].published_at,null);
});

test('staging preflight CLI is read-only and never echoes rejected candidate data',async()=>{
  const {mkdtemp,writeFile,readFile,readdir,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {fileURLToPath}=await import('node:url');
  const {spawnSync}=await import('node:child_process');
  const dir=await mkdtemp(join(tmpdir(),'media-preflight-'));
  const cli=fileURLToPath(new URL('../scripts/check-public-media-export.mjs',import.meta.url));
  const path=join(dir,'candidate.json');
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',cwd:dir});
  try{
    const good=JSON.stringify(rawExport([row('a')]));
    await writeFile(path,good);
    const accepted=run(path);
    assert.equal(accepted.status,0,accepted.stderr);
    assert.match(accepted.stdout,/1 records/);
    assert.equal(await readFile(path,'utf8'),good);
    const bad=JSON.stringify(rawExport([row('a',{editorial_status:'pending',human_notes:'PRIVATE_FIXTURE_CANARY'})]));
    await writeFile(path,bad);
    for(const input of [bad,'{"PRIVATE_FIXTURE_CANARY":']){
      await writeFile(path,input);
      const rejected=run(path);
      assert.equal(rejected.status,1);
      assert.doesNotMatch(rejected.stdout+rejected.stderr,/PRIVATE_FIXTURE_CANARY/);
      assert.equal(await readFile(path,'utf8'),input);
    }
    assert.equal(run().status,2);
    assert.equal(run(join(dir,'missing.json')).status,1);
    assert.deepEqual(await readdir(dir),['candidate.json']);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('publisher-reported date only is searchable without inventing Pacific day or time',()=>{
  const rows=[row('date-only',{published_at:null,published_date_reported:'2026-11-25'}),row('precise'),row('unknown',{published_at:null})];
  const checked=validatePublicMediaExport(rawExport(rows));
  assert.equal(checked.reports[0].published_at,null);
  assert.equal(checked.reports[0].published_date_reported,'2026-11-25');
  assert.equal(selectMedia(checked,{now:new Date('2026-11-25T10:00:00Z')}).reports.length,1);
  const found=selectMedia(checked,{query:'2026-11-25'});
  assert.equal(found.reports.length,2);
  assert.equal(found.dateOnly.length,1);
  assert.equal(found.undated.length,1);
  for(const invalid of ['2026-02-30','2026-11-25T00:00:00Z','2026-11-5',123])
    assert.throws(()=>validatePublicMediaExport(rawExport([row('bad',{published_at:null,published_date_reported:invalid})])),/Invalid/);
});

test('Pacific briefing freshness changes at local 06:00 and 18:00, including DST',()=>{
  for(const [instant,expected] of [
    ['2026-11-25T08:00:00Z','2026-11-24 18:00'],
    ['2026-11-25T13:59:59Z','2026-11-24 18:00'],
    ['2026-11-25T14:00:00Z','2026-11-25 06:00'],
    ['2026-11-26T01:59:59Z','2026-11-25 06:00'],
    ['2026-11-26T02:00:00Z','2026-11-25 18:00'],
    ['2026-07-01T13:00:00Z','2026-07-01 06:00'],
    ['2026-03-08T13:00:00Z','2026-03-08 06:00'],
    ['2026-11-01T14:00:00Z','2026-11-01 06:00']
  ])assert.equal(pacificRefreshWindow(instant),expected);
  const now=new Date('2026-11-25T15:00:00Z');
  assert.deepEqual(mediaFeedFreshness('2026-11-25T13:59:59Z',now),{window:'2026-11-25 06:00',state:'stale'});
  assert.equal(mediaFeedFreshness('2026-11-25T14:00:00Z',now).state,'checked');
  assert.equal(mediaFeedFreshness('2026-11-25T16:00:00Z',now).state,'unconfirmed');
  assert.equal(mediaFeedFreshness(null,now).state,'unconfirmed');
});

test('explicit staging creates only a validated private candidate and never retains rejected bytes',async()=>{
  const {mkdtemp,writeFile,readFile,readdir,rm,stat}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const {join}=await import('node:path');
  const {fileURLToPath}=await import('node:url');
  const {spawnSync}=await import('node:child_process');
  const dir=await mkdtemp(join(tmpdir(),'media-stage-test-'));
  const cli=fileURLToPath(new URL('../scripts/check-public-media-export.mjs',import.meta.url));
  const input=join(dir,'input.json');
  const run=()=>spawnSync(process.execPath,[cli,'--stage',input],{encoding:'utf8',cwd:dir,env:{...process.env,TMPDIR:dir,TMP:dir,TEMP:dir}});
  try{
    const good=rawExport([row('a'),row('b',{publisher_location:null,published_at:null,tone:'mixed'})]);
    // Repeated JSON keys are resolved by JSON.parse. Never copy discarded raw bytes.
    const raw=JSON.stringify(good).replace('"headline_original":"Water project"','"headline_original":"PRIVATE_DISCARDED_CANARY","headline_original":"Water project"');
    await writeFile(input,raw);
    const accepted=run();
    assert.equal(accepted.status,0,accepted.stderr);
    const dirs=(await readdir(dir)).filter(x=>x.startsWith('atlas-media-stage-'));
    assert.equal(dirs.length,1);
    const output=join(dir,dirs[0],'candidate-media-export.json');
    const staged=await readFile(output,'utf8');
    assert.deepEqual(JSON.parse(staged),good);
    assert.doesNotMatch(staged,/PRIVATE_DISCARDED_CANARY/);
    assert.equal(validatePublicMediaExport(JSON.parse(staged)).reports.length,2);
    assert.equal(await readFile(input,'utf8'),raw);
    if(process.platform!=='win32')assert.equal((await stat(output)).mode&0o777,0o600);
    for(const rejected of [JSON.stringify(rawExport([row('pending',{editorial_status:'pending',human_notes:'PRIVATE_REJECTED_CANARY'})])),'{"PRIVATE_REJECTED_CANARY":']){
      await writeFile(input,rejected);
      const result=run();
      assert.equal(result.status,1);
      assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_REJECTED_CANARY/);
      assert.deepEqual((await readdir(dir)).filter(x=>x.startsWith('atlas-media-stage-')),dirs);
      assert.equal(await readFile(input,'utf8'),rejected);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
