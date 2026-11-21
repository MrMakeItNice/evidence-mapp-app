// Run: node --test tests/global-search-sources.test.cjs
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('global-search.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);assert.doesNotThrow(()=>new Function(script));assert.match(html,/id="source-results"/);
function setup(options={}){
 const els=new Map();
 const node=(tag='div')=>({tag,children:[],textContent:'',value:'',addEventListener(){},append(...x){this.children.push(...x)},replaceChildren(...x){this.children=x}});
 const document={getElementById:id=>{if(!els.has(id))els.set(id,node());return els.get(id)},createElement:node,createTextNode:t=>({tag:'#text',textContent:t,children:[]})};
 const app=new Function('document','location','history','fetch','URL','URLSearchParams','AbortController','setTimeout','clearTimeout',script+';return {seed:(c,r)=>{cases=c;loaded=true;refs=r;sourcesLoaded=true},renderSourceRecords,originalDocumentUrl,search}')(
 document,{search:options.search||'',href:'https://atlas.example/global-search.html'},{replaceState(){}},options.fetch||(()=>new Promise(()=>{})),URL,URLSearchParams,AbortController,()=>1,()=>{});
 return {app,get:id=>document.getElementById(id)};
}
const all=n=>[n,...(n.children||[]).flatMap(all)];
test('deduplicates cross-case citations and filters nonpublished cases',()=>{
 const {app,get}=setup();app.seed([{id:1,title:'Case One'},{id:2,title:'Case Two'}],[
 {case_id:1,source_id:7,title:'Audit <Report>',publisher:'Agency',publication_date:'1991-01-01',url:'https://records.example/report?id=7'},
 {case_id:2,source_id:7,title:'Audit <Report>',url:'https://records.example/report?id=7'},
 {case_id:99,source_id:8,title:'Audit unpublished',url:'https://records.example/hidden'}]);
 app.renderSourceRecords('audit');assert.match(get('source-status').textContent,/^1 matching/);
 const rows=get('source-results').children;assert.equal(rows.length,1);
 const links=all(rows[0]).filter(n=>n.tag==='a');assert.equal(links.length,3);
 assert.equal(links[0].textContent,'Audit <Report> ↗');assert.equal(links[0].rel,'noopener noreferrer');
 assert.match(rows[0].children[1].textContent,/Agency.*1991-01-01.*Host: records.example/);
 assert.ok(links.some(l=>l.href.endsWith('#case-2')));assert.ok(!links.some(l=>l.href.includes('99')));
});
test('rejects unsafe original links while keeping source IDs separate',()=>{
 const {app,get}=setup();app.seed([{id:1,title:'Published case'}],[
 {case_id:1,source_id:11,title:'Survey first',url:'javascript:alert(1)'},
 {case_id:1,source_id:12,title:'Survey second',url:'data:text/html,boom'}]);
 app.renderSourceRecords('survey');assert.match(get('source-status').textContent,/^2 matching/);
 for(const row of get('source-results').children){const links=all(row).filter(n=>n.tag==='a');assert.equal(links.length,1);assert.ok(links[0].href.startsWith('./paper-trails.html'))}
 assert.equal(app.originalDocumentUrl('javascript:alert(1)'),null);
 assert.equal(app.originalDocumentUrl('https://user:secret@site.example/doc'),null);
 assert.equal(app.originalDocumentUrl('https://site.example/doc'),'https://site.example/doc');
});
test('does not expose source records without a published linked case',()=>{
 const {app,get}=setup();app.seed([], [{case_id:99,source_id:9,title:'Not published',url:'https://example.com'}]);
 app.renderSourceRecords('not published');assert.equal(get('source-results').children.length,1);
 assert.match(get('source-results').children[0].textContent,/No matching indexed source records/);
});

const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const first of ['cases','sources'])test('delayed '+first+' uses latest submitted query, not URL or unsent edits',async()=>{
 let casesReady,sourcesReady;
 const {app,get}=setup({search:'?q=old',fetch:url=>{
  if(url==='./paper-trails-data.json')return new Promise(r=>sourcesReady=r);
  if(String(url).includes('/api/cases'))return new Promise(r=>casesReady=r);
  return new Promise(()=>{});
 }});
 app.search(' newest ');get('q').value='unsent';
 assert.match(get('archive-status').textContent,/Loading/);
 assert.match(get('source-status').textContent,/Waiting/);
 const resolveCases=()=>casesReady({ok:true,json:async()=>[{id:1,title:'newest case'},{id:2,title:'old case'},{id:3,title:'unsent case'}]});
 const resolveSources=()=>sourcesReady({ok:true,json:async()=>({references:[
  {case_id:1,source_id:1,title:'newest report',url:'https://example.org/new'},
  {case_id:2,source_id:2,title:'old report',url:'https://example.org/old'},
  {case_id:3,source_id:3,title:'unsent report',url:'https://example.org/unsent'}]})});
 (first==='cases'?resolveCases:resolveSources)();await settle();
 (first==='cases'?resolveSources:resolveCases)();await settle();
 assert.equal(get('q').value,'unsent');
 assert.match(get('archive-status').textContent,/^1 matching/);
 assert.match(get('source-status').textContent,/^1 matching/);
 for(const id of ['results','source-results']){
  const text=all(get(id)).map(n=>n.textContent).join(' ');
  assert.match(text,/newest/);assert.doesNotMatch(text,/old (case|report)|unsent (case|report)/);
 }
});
for(const failure of ['cases','sources'])test(failure+' failure stays distinct from no matches',async()=>{
 const {app,get}=setup({fetch:async url=>{
  if(String(url).includes('/api/cases')){
   if(failure==='cases')throw Error('offline');
   return {ok:true,json:async()=>[{id:1,title:'newest case'}]};
  }
  if(url==='./paper-trails-data.json'){
   if(failure==='sources')throw Error('offline');
   return {ok:true,json:async()=>({references:[]})};
  }
  return new Promise(()=>{});
 }});
 app.search('newest');await settle();
 assert.doesNotMatch(get('source-status').textContent,/No matching|Loading|Waiting/);
 assert.match(get('source-status').textContent,/unavailable/);
 if(failure==='sources')assert.match(get('archive-status').textContent,/^1 matching/);
 else assert.match(get('archive-status').textContent,/could not be loaded/);
});
