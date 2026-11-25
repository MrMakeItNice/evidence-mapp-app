import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
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

test('canonical IDs reject whitespace-variant duplicate verified events',()=>{
  const variant={...original,id:' report-1 '};
  assert.throws(()=>reviewedEventsFromFeed(feed([original,variant])),/Invalid or duplicate/);
  assert.throws(()=>reviewedEventsFromFeed(feed([variant,original])),/Invalid or duplicate/);
  const normalized=reviewedEventsFromFeed(feed([variant]));
  assert.equal(normalized.length,1);
  assert.equal(normalized[0].id,'report-1');
  assert.equal(original.id,'report-1'); // source fixture remains unchanged
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

function simulateTopPulse({data=feed([original]),networkError=false}={}){
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/data-pulse="positive" aria-pressed="true"/);
  const start=html.indexOf('const pulseCriteria=');
  const end=html.indexOf("const mapList=",start);
  assert.ok(start>=0&&end>start,'find the actual globe pulse controller');
  const script=html.slice(start,end);
  const panel={textContent:'Select a category for criteria.'};
  const buttons=Object.fromEntries(['negative','neutral','positive'].map(category=>{
    const button={
      dataset:{pulse:category},count:{textContent:'—'},
      attributes:{'aria-pressed':category==='positive'?'true':'false'},
      handlers:{},
      querySelector(selector){assert.equal(selector,'strong');return this.count;},
      getAttribute(name){return this.attributes[name];},
      setAttribute(name,value){this.attributes[name]=value;},
      addEventListener(name,callback){this.handlers[name]=callback;},
      click(){this.handlers.click();}
    };
    return [category,button];
  }));
  const document={
    querySelectorAll(selector){assert.equal(selector,'[data-pulse]');return Object.values(buttons);},
    getElementById(id){assert.equal(id,'pulse-panel');return panel;}
  };
  const request=vm.runInNewContext('(async()=>{'+script+'})()',{
    document,reviewedEventsFromFeed,
    fetch:async()=>{
      if(networkError)throw Error('mock feed offline');
      return {ok:true,json:async()=>data};
    }
  },{timeout:2000});
  return {request,panel,buttons};
}

test('category switches preserve reviewed counts and current category rationale',async()=>{
  const {request,panel,buttons}=simulateTopPulse();
  await request;
  assert.equal(buttons.positive.count.textContent,'1');
  assert.equal(buttons.negative.count.textContent,'0');
  assert.equal(buttons.neutral.count.textContent,'0');
  assert.match(panel.textContent,/1 reviewed event in this curated feed/);
  buttons.negative.click();
  assert.equal(buttons.negative.getAttribute('aria-pressed'),'true');
  assert.equal(buttons.positive.getAttribute('aria-pressed'),'false');
  assert.match(panel.textContent,/Documented harm/);
  assert.match(panel.textContent,/0 reviewed events in this curated feed/);
  buttons.positive.click();
  assert.match(panel.textContent,/Documented improvements/);
  assert.match(panel.textContent,/1 reviewed event in this curated feed/);
  assert.doesNotMatch(panel.textContent,/No audited count available yet/);
});

test('duplicate canonical IDs with whitespace fail closed in the actual top Pulse',async()=>{
  const {request,panel,buttons}=simulateTopPulse({data:feed([original,{...original,id:' report-1 '}])});
  await request;
  assert.ok(Object.values(buttons).every(button=>button.count.textContent==='—'));
  assert.match(panel.textContent,/Reviewed event feed unavailable/);
});

test('empty reviewed feed retains unknown counts after category changes',async()=>{
  const {request,panel,buttons}=simulateTopPulse({data:feed([])});
  await request;
  assert.ok(Object.values(buttons).every(button=>button.count.textContent==='—'));
  buttons.neutral.click();
  assert.match(panel.textContent,/Mixed, uncertain/);
  assert.match(panel.textContent,/No reviewed events available yet; counts are not zero/);
});

test('feed errors and invalid verified records remain unavailable after switches',async()=>{
  for(const opts of [
    {networkError:true},
    {data:feed([{...original,source_url:'https://agency.gov@untrusted.invalid/report'}])}
  ]){
    const {request,panel,buttons}=simulateTopPulse(opts);
    await request;
    buttons.negative.click();
    assert.ok(Object.values(buttons).every(button=>button.count.textContent==='—'));
    assert.match(panel.textContent,/Reviewed event feed unavailable; no global count can be calculated/);
    assert.doesNotMatch(panel.textContent,/0 reviewed events/);
  }
});

test('reviewed pulse integration preserves accessible native globe scrolling',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.equal((html.match(/touch-action:pan-y/g)||[]).length,1);
  assert.doesNotMatch(html,/\.globe-canvas\{touch-action:none/);
  assert.match(html,/e\.cancelable&&e\.pointerType==='mouse'/);
  assert.match(html,/Swipe vertically to scroll/);
  assert.match(html,/data-pulse="positive" aria-pressed="true"/);
  assert.match(html,/reviewedEvents=reviewedEventsFromFeed\(feed\)/);
});
