// Static Paper Trails source-publication snapshot regression.
// Run: node --test tests/paper-trails-publication-gate.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'paper-trails-data.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'paper-trails.html'), 'utf8');
const gate = data.publication_gate;

test('export records its explicit source-publication gate and snapshot date', () => {
  assert.equal(gate.field, 'public.sources.published');
  assert.match(gate.checked_on, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(data.generated_on, gate.checked_on);
  assert.match(data.note, /not independent verification/i);
});

test('all static source links are present in the approved snapshot allowlist', () => {
  assert.ok(Array.isArray(data.references) && data.references.length > 0);
  const ids = gate.approved_source_ids;
  assert.ok(Array.isArray(ids) && ids.length > 0);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.equal(new Set(ids).size, ids.length);
  const seen = new Set();
  for (const ref of data.references) {
    assert.ok(Number.isInteger(ref.source_id) && ref.source_id > 0);
    assert.ok(Number.isInteger(ref.case_id) && ref.case_id > 0);
    assert.ok(ids.includes(ref.source_id), 'source ' + ref.source_id + ' not marked published at export');
    seen.add(ref.source_id);
  }
  assert.deepEqual(seen, new Set(ids));
  assert.equal(data.references.length, gate.reference_count);
  assert.equal(seen.size, gate.distinct_source_count);
});

test('known unapproved sources from QA #341 remain excluded until intentional review', () => {
  const ids = new Set(data.references.map(ref => ref.source_id));
  for (const id of [8, 18, 20, 34, 60]) assert.equal(ids.has(id), false, 'source ' + id + ' requires new editorial check');
});

test('Paper Trails filters source links by the allowlist and reports snapshot status', () => {
  assert.match(html, /const idsValid=Array\.isArray\(declaredIds\)/);
  assert.match(html, /gate\.reference_count===rows\.length/);
  assert.match(html, /sourceGateReady=gateReady;refs=gateReady\?rows:\[\]/);
  assert.match(html, /id="sourceGate"/);
  assert.match(html, /Source publication gate unavailable; citation links are withheld/);
});

async function loadPage(snapshot,fail=false,options={}){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:'',hidden:true,attributes:{},handlers:{},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.handlers[k]=fn},focus(){},scrollIntoView(){}});return elements.get(id)};
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 new Function('document','window','history','location','fetch','AbortController','setTimeout','clearTimeout',script)(
  {getElementById:get},{addEventListener(type,handler){if(options.events)options.events[type]=handler}},{replaceState(){}},options.location||{hash:options.hash??'#case-42'},
  options.fetch||(async url=>({ok:!fail,json:async()=>url==='./paper-trails-data.json'?snapshot:(options.cases??[{id:42,case_number:42,title:'Test case',category:'Test'}])})),
  AbortController,options.setTimeout||setTimeout,options.clearTimeout||clearTimeout
 );
 await new Promise(resolve=>setImmediate(resolve));return get;
}
const publishedFixture=(references,approvedIds=[...new Set(references.map(r=>r.source_id))])=>({
 generated_on:'2026-11-21',
 publication_gate:{field:'public.sources.published',checked_on:'2026-11-21',approved_source_ids:approvedIds,reference_count:references.length,distinct_source_count:approvedIds.length},
 references
});

test('missing snapshot explains withheld citations throughout the rendered case',async()=>{
 const get=await loadPage({references:[{case_id:42,source_id:1,title:'Do not expose',url:'https://example.org'}]});
 assert.match(get('sourceGate').textContent,/unavailable; citation links are withheld/);
 assert.match(get('summary').textContent,/citation links withheld/);
 assert.match(get('caseList').innerHTML,/Citation links withheld/);
 assert.match(get('detail').innerHTML,/<h3>Citation links withheld<\/h3>/);
 assert.doesNotMatch(get('detail').innerHTML,/Do not expose|Linked public records \(0\)/);
 assert.match(get('documentTimeline').innerHTML,/timeline withheld/);
 assert.match(get('connectionMap').innerHTML,/connections withheld/);
});

test('checked empty archive stays distinct from unavailable publication checks',async()=>{
 const get=await loadPage(publishedFixture([]));
 assert.match(get('sourceGate').textContent,/checked 2026-11-21/);
 assert.match(get('summary').textContent,/0 public source links/);
 assert.match(get('detail').innerHTML,/Linked public records \(0\)/);
 assert.doesNotMatch(get('detail').innerHTML,/Citation links withheld/);
});

test('approved citations remain visible with a consistent export manifest',async()=>{
 const get=await loadPage(publishedFixture([
  {case_id:42,source_id:1,title:'Approved report',url:'https://example.org/approved',publication_date:'2026-11-20'}
 ]));
 assert.match(get('sourceGate').textContent,/checked 2026-11-21/);
 assert.match(get('summary').textContent,/1 public source links/);
 assert.match(get('detail').innerHTML,/Approved report/);
});

test('source previews identify the recorded publisher, original website, reference and catalog role',async()=>{
 const get=await loadPage(publishedFixture([{
  case_id:42,source_id:7,title:'Archive report',publisher:'National Archive',
  publication_date:'2026-11-20',reference_code:'DOC-7',source_role:'Historical source citation',
  url:'https://records.example.org/archive/7'
 }]));
 const pane=get('detail').innerHTML;
 assert.match(pane, /Indexed publisher:<\/strong> National Archive/);
 assert.match(pane, /Publication date:<\/strong> 2026-11-20/);
 assert.match(pane, /Reference code:<\/strong> DOC-7/);
 assert.match(pane, /Source record ID:<\/strong> 7/);
 assert.match(pane, /Index role:<\/strong> Historical source citation/);
 assert.match(pane, /Document host:<\/strong> records\.example\.org · Opens in a new tab/);
 assert.match(pane, /not independent verification of its claims/);
});

test('incomplete metadata and invalid source links stay visible as non-clickable limitations',async()=>{
 const get=await loadPage(publishedFixture([{
  case_id:42,source_id:9,title:'Unavailable archived record',url:'javascript:alert(1)'
 }]));
 const pane=get('detail').innerHTML;
 assert.match(pane, /<strong>Unavailable archived record<\/strong>/);
 assert.match(pane, /Indexed publisher:<\/strong> Not recorded/);
 assert.match(pane, /Publication date:<\/strong> Not recorded/);
 assert.match(pane, /Reference code:<\/strong> Not recorded/);
 assert.match(pane, /Index role:<\/strong> Not recorded/);
 assert.match(pane, /Document host:<\/strong> Not available · No validated HTTPS document link/);
 assert.doesNotMatch(pane, /href="javascript:/);
});

test('an unexpected unapproved source row invalidates the entire snapshot',async()=>{
 const get=await loadPage(publishedFixture([
  {case_id:42,source_id:1,title:'Approved report',url:'https://example.org/approved'},
  {case_id:42,source_id:2,title:'Pending report',url:'https://example.org/pending'}
 ],[1]));
 assert.match(get('sourceGate').textContent,/unavailable; citation links are withheld/);
 assert.match(get('summary').textContent,/citation links withheld/);
 assert.doesNotMatch(get('detail').innerHTML,/Approved report|Pending report|example.org\/pending/);
});

test('missing or inconsistent snapshot manifest always withholds citations',async()=>{
 const ref={case_id:42,source_id:1,title:'Unconfirmed citation',url:'https://example.org/unconfirmed'};
 const fixtures=[
  x=>{delete x.publication_gate.reference_count},
  x=>{x.publication_gate.reference_count=2},
  x=>{x.publication_gate.distinct_source_count=2},
  x=>{x.publication_gate.approved_source_ids=[1,1]},
  x=>{x.publication_gate.approved_source_ids=['1']},
  x=>{x.publication_gate.approved_source_ids=[1,2]},
  x=>{x.generated_on='2026-11-10'},
  x=>{x.references=null},
  x=>{x.references[0].case_id='42'}
 ];
 for(const mutate of fixtures){
  const snapshot=publishedFixture([{...ref}]);mutate(snapshot);
  const get=await loadPage(snapshot);
  assert.match(get('sourceGate').textContent,/unavailable; citation links are withheld/);
  assert.match(get('summary').textContent,/citation links withheld/);
  assert.doesNotMatch(get('detail').innerHTML,/Unconfirmed citation/);
 }
});

test('checked-in export does not duplicate case-source pairs or disagree on source identity',()=>{
 const pairs=new Set(),metadata=new Map();
 for(const row of data.references){
  const pair=row.case_id+':'+row.source_id;
  assert.equal(pairs.has(pair),false,'duplicate exported link: '+pair);
  pairs.add(pair);
  const fingerprint=JSON.stringify([row.title??null,row.url??null,row.publisher??null,row.publication_date??null,row.reference_code??null]);
  if(metadata.has(row.source_id))assert.equal(fingerprint,metadata.get(row.source_id),'conflicting exported metadata for source '+row.source_id);
  metadata.set(row.source_id,fingerprint);
 }
});

test('repeated source IDs need unique case associations and consistent document provenance',async()=>{
 const shared={source_id:7,title:'Archive report',url:'https://records.example.org/7',publisher:'National Archive',publication_date:'2026-11-20',reference_code:'DOC-7'};
 const first={...shared,case_id:42,source_role:'Primary evidence'};
 const second={...shared,case_id:43,source_role:'Context only'};
 const getValid=await loadPage(publishedFixture([first,second]));
 assert.match(getValid('sourceGate').textContent,/checked 2026-11-21/,'different citation roles across cases are legitimate');
 const mutations=[
  [first,{...first}],
  [first,{...second,url:'https://other.example.org/7'}],
  [first,{...second,title:'Different document'}],
  [first,{...second,publisher:'Different publisher'}],
  [first,{...second,publication_date:'2026-11-19'}],
  [first,{...second,reference_code:'DOC-8'}]
 ];
 for(const rows of mutations){
  const get=await loadPage(publishedFixture(rows));
  assert.match(get('sourceGate').textContent,/unavailable; citation links are withheld/);
  assert.match(get('summary').textContent,/citation links withheld/);
  assert.doesNotMatch(get('detail').innerHTML,/Archive report|records.example.org\/7/);
 }
});

test('shared-source connections show a distinct record count and provenance names',async()=>{
 const first={source_id:7,title:'Report A & supporting files',url:'https://records.example.org/a',publisher:'Archive'};
 const second={source_id:8,title:'Report B',url:'https://records.example.org/b',publisher:'Archive'};
 const rows=[first,second].flatMap(source=>[
  {...source,case_id:42,source_role:'Primary citation'},
  {...source,case_id:99,source_role:'Historical context'}
 ]);
 const get=await loadPage(publishedFixture(rows),false,{cases:[
  {id:42,case_number:42,title:'Selected case',category:'Test'},
  {id:99,case_number:99,title:'Related case',category:'Test'}
 ]});
 const map=get('connectionMap').innerHTML;
 assert.equal((map.match(/class="connection-node"/g)||[]).length,1,'one destination per related case');
 assert.match(map,/data-related="99"/);
 assert.match(map,/Shared published records \(2\): Report A &amp; supporting files; Report B/);
 assert.doesNotMatch(map,/Shared record: Report B/,'do not silently discard earlier overlapping sources');
});

test('long shared-source lists disclose the full count and distinguish withheld links',async()=>{
 const sources=[7,8,9,10].map((id,index)=>({
  source_id:id,title:'Report '+(index+1),url:'https://records.example.org/'+id
 }));
 const rows=sources.flatMap(source=>[{...source,case_id:42},{...source,case_id:99}]);
 const options={cases:[{id:42,case_number:42,title:'Selected case'},{id:99,case_number:99,title:'Related case'}]};
 const approved=await loadPage(publishedFixture(rows),false,options);
 const map=approved('connectionMap').innerHTML;
 assert.match(map,/Shared published records \(4\): Report 1; Report 2; Report 3 · 1 more \(open case to inspect\)/);
 assert.doesNotMatch(map,/Report 4/,'long previews must remain concise');
 const withUnapproved=await loadPage(publishedFixture(rows,[7,8,9]),false,options);
 assert.match(withUnapproved('connectionMap').innerHTML,/Shared-source connections withheld/);
 assert.doesNotMatch(withUnapproved('connectionMap').innerHTML,/Report 1|Report 2/);
});

test('archive failure replaces the pending snapshot message',async()=>{
 const get=await loadPage({},true);
 assert.match(get('sourceGate').textContent,/could not be checked.*remain withheld/);
 assert.doesNotMatch(get('sourceGate').textContent,/Checking/);
 assert.match(get('summary').textContent,/temporarily unavailable/);
});


for(const phase of ['headers','case-body','source-body'])test('deadline covers stalled '+phase+' and withholds citations',async()=>{
 let fire,cleared=0;const signals=[];
 const get=await loadPage({},false,{
  setTimeout(fn,ms){assert.equal(ms,15000);fire=fn;return 77},
  clearTimeout(id){assert.equal(id,77);cleared++},
  fetch:async(url,{signal})=>{
   signals.push(signal);
   const stalled=()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
   if(phase==='headers')return stalled();
   return {ok:true,json:()=>{
    const isSource=url==='./paper-trails-data.json';
    if((phase==='case-body'&&!isSource)||(phase==='source-body'&&isSource))return stalled();
    return Promise.resolve(isSource?publishedFixture([]):[{id:42,title:'Test case'}]);
   }};
  }
 });
 assert.equal(cleared,0,'deadline stays active through response parsing');
 fire();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(cleared,1);assert.equal(signals.length,2);assert.ok(signals.every(s=>s.aborted));
 assert.match(get('summary').textContent,/timed out/);
 assert.match(get('sourceGate').textContent,/timed out.*remain withheld/);
 assert.match(get('caseList').innerHTML,/Retry archive to try again/);
 assert.doesNotMatch(get('detail').innerHTML,/Linked public records/);
});

test('success and HTTP failure both clean up their pending deadline',async()=>{
 for(const failure of [false,true]){
  let cleared=0;
  const get=await loadPage(publishedFixture([]),failure,{
   setTimeout(_fn,ms){assert.equal(ms,15000);return 88},
   clearTimeout(id){assert.equal(id,88);cleared++}
  });
  assert.equal(cleared,1);
  assert.doesNotMatch(get('summary').textContent,/timed out/);
 }
});

test('in-page retry recovers without duplicate requests or losing search, topic and case',async()=>{
 let recovering=false,calls=0;const pending=[];
 const get=await loadPage({},false,{fetch:async url=>{
  calls++;if(!recovering)return {ok:false};
  return new Promise(resolve=>pending.push({url,resolve}));
 }});
 assert.equal(get('retryArchive').hidden,false);assert.equal(calls,2);
 get('search').value='Test';get('topic').value='Test';recovering=true;
 get('retryArchive').handlers.click();get('retryArchive').handlers.click();
 assert.equal(calls,4,'second activation cannot start overlapping loads');
 assert.equal(get('retryArchive').attributes['aria-disabled'],'true');
 assert.equal(get('search').disabled,true);assert.equal(get('topic').disabled,true);
 assert.doesNotMatch(get('detail').innerHTML,/Linked public records/);
 for(const {url,resolve} of pending)resolve({ok:true,json:async()=>url==='./paper-trails-data.json'?publishedFixture([]):[{id:42,case_number:42,title:'Test case',category:'Test'}]});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('search').value,'Test');assert.equal(get('topic').value,'Test');
 assert.equal(get('search').disabled,false);assert.equal(get('topic').disabled,false);
 assert.match(get('detail').innerHTML,/Test case/);assert.match(get('summary').textContent,/1 case files/);
 assert.equal(get('retryArchive').hidden,true);assert.equal(get('retryArchive').attributes['aria-disabled'],'false');
});

test('retry remains available while the publication snapshot is invalid',async()=>{
 const get=await loadPage({references:[]});
 assert.equal(get('retryArchive').hidden,false);assert.equal(get('retryArchive').attributes['aria-disabled'],'false');
 assert.match(get('sourceGate').textContent,/links are withheld/);
 assert.equal(get('search').disabled,false,'case searching remains available when cases load');
});


test('completed loads show distinct prompts for no selection, missing bookmark and empty cases',async()=>{
 for(const [options,message] of [
  [{hash:''},'Choose a case to follow its paper trail'],
  [{hash:'#case-999'},'Case unavailable in this archive'],
  [{cases:[]},'No published cases available']
 ]){
  const get=await loadPage(publishedFixture([]),false,options);
  assert.ok(get('detail').innerHTML.includes(message));
  assert.doesNotMatch(get('detail').innerHTML,/Checking archive/);
  assert.match(get('sourceGate').textContent,/checked 2026-11-21/);
 }
});

test('hash changes clear stale case details and selection when the bookmark is unavailable',async()=>{
 const location={hash:'#case-42'},events={};
 const get=await loadPage(publishedFixture([]),false,{location,events});
 assert.match(get('detail').innerHTML,/Test case/);
 location.hash='#case-999';events.hashchange();
 assert.match(get('detail').innerHTML,/Case unavailable in this archive/);
 assert.doesNotMatch(get('detail').innerHTML,/Test case|Linked public records/);
 assert.doesNotMatch(get('caseList').innerHTML,/aria-pressed="true"/);
 location.hash='';events.hashchange();assert.match(get('detail').innerHTML,/Choose a case/);
 location.hash='#case-42';events.hashchange();assert.match(get('detail').innerHTML,/Test case/);
});

test('filter counts are a polite status with singular, plural and empty results',async()=>{
 assert.match(html, /id="resultCount"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
 const get=await loadPage(publishedFixture([]),false,{hash:'',cases:[
  {id:42,case_number:42,title:'Alpha record',category:'Archive'},
  {id:99,case_number:99,title:'Beta record',category:'Finance'}
 ]});
 assert.equal(get('resultCount').textContent,'2 matching cases');
 get('search').focus=()=>assert.fail('filtering must not move focus');
 get('topic').focus=()=>assert.fail('filtering must not move focus');
 get('search').value='Alpha';get('search').handlers.input();
 assert.equal(get('resultCount').textContent,'1 matching case');
 get('topic').value='Finance';get('topic').handlers.change();
 assert.equal(get('resultCount').textContent,'0 matching cases');
 assert.match(get('caseList').innerHTML,/No matching cases/);
 get('search').value='';get('search').handlers.input();
 assert.equal(get('resultCount').textContent,'1 matching case');
 get('topic').value='';get('topic').handlers.change();
 assert.equal(get('resultCount').textContent,'2 matching cases');
});

test('selecting and revisiting a case does not repeat an unchanged result announcement',async()=>{
 const location={hash:''},events={};
 const get=await loadPage(publishedFixture([]),false,{location,events});
 let text=get('resultCount').textContent,writes=0;
 Object.defineProperty(get('resultCount'),'textContent',{get:()=>text,set(value){text=value;writes++}});
 location.hash='#case-42';events.hashchange();events.hashchange();
 assert.match(get('detail').innerHTML,/Test case/);
 assert.equal(text,'1 matching case');assert.equal(writes,0);
});

test('unavailable and retrying archives never announce a stale or false zero-match count',async()=>{
 let recovering=false;const pending=[];
 const get=await loadPage({},false,{fetch:async url=>{
  if(!recovering)return {ok:false};
  return new Promise(resolve=>pending.push({url,resolve}));
 }});
 assert.equal(get('resultCount').textContent,'');
 get('resultCount').textContent='3 matching cases';recovering=true;
 get('retryArchive').handlers.click();
 assert.equal(get('resultCount').textContent,'');
 for(const {url,resolve} of pending)resolve({ok:true,json:async()=>url==='./paper-trails-data.json'?publishedFixture([]):[{id:42,title:'Test case'}]});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(get('resultCount').textContent,'1 matching case');
});

test('credentialed approved records remain non-clickable in previews and timelines',async()=>{
 for(const url of ['https://archives.gov@untrusted.example/report','https://reader:password@archives.gov/report','https://:password@archives.gov/report']){
  const get=await loadPage(publishedFixture([
   {case_id:42,source_id:1,title:'Restricted destination',url,publication_date:'2020-01-01'},
   {case_id:42,source_id:2,title:'Public document',url:'https://archives.gov/report?id=42#page=2',publication_date:'2020-01-02'}
  ]));
  assert.match(get('sourceGate').textContent,/checked/,'source publication approval remains distinct from URL validation');
  assert.match(get('detail').innerHTML,/<strong>Restricted destination<\/strong>/);
  assert.match(get('detail').innerHTML,/No validated HTTPS document link/);
  assert.ok(!get('detail').innerHTML.includes(url),'blocked destination must not appear in preview markup');
  assert.match(get('detail').innerHTML,/href="https:\/\/archives.gov\/report\?id=42#page=2"/);
  const timeline=get('documentTimeline').innerHTML;
  assert.match(timeline,/Restricted destination/,'retain the non-clickable record title and date');
  assert.ok(!timeline.includes(url));
  assert.equal((timeline.match(/<a href=/g)||[]).length,1,'only the public destination gets a timeline link');
  assert.match(timeline,/href="https:\/\/archives.gov\/report\?id=42#page=2"/);
 }
});

test('timeline links name their own document and replace that context when switching cases',async()=>{
 const location={hash:'#case-42'},events={};
 const get=await loadPage(publishedFixture([
  {case_id:42,source_id:1,title:'Record "A" & testimony',publisher:'Archive & Library',publication_date:'2020-01-01',url:'https://archives.gov/a'},
  {case_id:42,source_id:2,publication_date:'2020-01-02',url:'https://archives.gov/b'},
  {case_id:42,source_id:3,title:'Blocked source',publication_date:'2020-01-03',url:'https://archives.gov@untrusted.example/c'},
  {case_id:99,source_id:4,title:'Different case record',publisher:'Other archive',publication_date:'2021-02-03',url:'https://archives.gov/d'}
 ]),false,{location,events,cases:[{id:42,title:'First case'},{id:99,title:'Second case'}]});
 const first=get('documentTimeline').innerHTML;
 assert.ok(first.includes('aria-label="Read record: Record &quot;A&quot; &amp; testimony · Archive &amp; Library · 2020-01-01 (opens in a new tab)"'));
 assert.ok(first.includes('aria-label="Read record: Source document · 2020-01-02 (opens in a new tab)"'));
 assert.equal((first.match(/aria-label="Read record:/g)||[]).length,2);
 assert.ok(first.includes('>Read record <span aria-hidden="true">↗</span></a>'));
 assert.ok(!first.includes('aria-label="Read record: Blocked source'));
 location.hash='#case-99';events.hashchange();
 const second=get('documentTimeline').innerHTML;
 assert.ok(second.includes('aria-label="Read record: Different case record · Other archive · 2021-02-03 (opens in a new tab)"'));
 assert.ok(!second.includes('Record &quot;A&quot;'));assert.ok(!second.includes('2020-01-02'));
 assert.equal((second.match(/aria-label="Read record:/g)||[]).length,1);
});
