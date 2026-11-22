import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {reviewedEventsFromFeed} from '../pulse-events.mjs';

const original={id:'report-1',title:'Documented local improvement',category:'positive',event_date:'2026-11-19',lat:37.8,lon:-122.4,source_url:'https://agency.gov/report?item=1#section',review_status:'verified'};
const feed=events=>({schema_version:1,events});

test('both displays use the same reviewed-event gate',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<script type="module">\s*import \{reviewedEventsFromFeed\} from "\.\/pulse-events\.mjs";[\s\S]*?const pulseCriteria=/);
  assert.match(html,/reviewedEvents=reviewedEventsFromFeed\(feed\)/);
  assert.match(html,/<script type="module">\s*import \{reviewedEventsFromFeed\} from "\.\/pulse-events\.mjs";\s*\/\* Counts reflect/);
  assert.match(html,/const reviewed=reviewedEventsFromFeed\(data\)/);
});

test('homepage inline modules parse as valid JavaScript',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const modules=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
  assert.ok(modules.length>=2);
  for(const [i,script] of modules.entries()){
    const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:script[1],encoding:'utf8'});
    assert.equal(result.status,0,'inline module '+i+': '+result.stderr);
  }
});

test('counts distinct verified events, not unpublished drafts',()=>{
  assert.deepEqual(reviewedEventsFromFeed(feed([original,{...original,id:'draft-2',review_status:'pending'}])),[original]);
  assert.deepEqual(reviewedEventsFromFeed(feed([])),[]);
});

test('invalid schema and duplicate verified IDs fail closed',()=>{
  assert.throws(()=>reviewedEventsFromFeed({events:[original]}),/Invalid reviewed-event feed/);
  assert.throws(()=>reviewedEventsFromFeed(feed([original,{...original,title:'Duplicate'}])),/Invalid or duplicate/);
});

test('bad calendar dates, coordinates and missing provenance fail closed',()=>{
  for(const changes of [{event_date:'2026-02-30'},{event_date:'2026-15-12'},{lat:91},{lon:-181},{lat:'37'},{title:'  '},{source_url:'javascript:alert(1)'},{source_url:'https://government.gov@untrusted.example/document'},{source_url:'http://agency.gov/report'}]){
    assert.throws(()=>reviewedEventsFromFeed(feed([{...original,...changes}])),/Invalid or duplicate/,JSON.stringify(changes));
  }
});

test('valid HTTPS source documents preserve query strings and fragments',()=>{
  const event={...original,source_url:'https://agency.gov/archive?doc=127#p7'};
  assert.equal(reviewedEventsFromFeed(feed([event]))[0].source_url,event.source_url);
});
