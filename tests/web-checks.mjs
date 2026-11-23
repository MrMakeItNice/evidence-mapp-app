import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
function edge(slug,{env={},fetch:mockFetch=async()=>{throw Error('Unexpected fetch')}}={}){let handler;const code=fs.readFileSync(`supabase/functions/${slug}/index.ts`,'utf8').replace(/^import[^\n]*\n/gm,'');const ctx={Deno:{env:{get:k=>env[k]||''},serve:h=>handler=h},fetch:mockFetch,URL,Response,Request,AbortSignal,console,setTimeout,clearTimeout,OWNER_HTML:'OWNER_PAGE',PUBLIC_HTML:'PUBLIC_PAGE',PRIVACY_HTML:'PRIVACY_PAGE',HEALING_HTML:'HEALING_PAGE'};vm.runInNewContext(stripTypeScriptTypes(code),ctx);return handler;}
const base='https://example.supabase.co/functions/v1/';
let queries=[];let handler=edge('evidence-atlas',{env:{SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public-test'},fetch:async(u)=>{queries.push(new URL(u));return Response.json([{id:1,title:'Published'}]);}});
let r=await handler(new Request(base+'evidence-atlas/api/cases'));assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/json/);assert.equal((await r.json()).length,1);assert.equal(queries[0].searchParams.get('published'),'eq.true');assert.ok(!queries[0].searchParams.get('select').includes('description'));
assert.equal(await(await handler(new Request(base+'evidence-atlas/healing'))).text(),'HEALING_PAGE');assert.equal(await(await handler(new Request(base+'evidence-atlas?workspace=1'))).text(),'OWNER_PAGE');assert.equal(await(await handler(new Request(base+'evidence-atlas'))).text(),'PUBLIC_PAGE');assert.equal((await handler(new Request(base+'evidence-atlas/api/unknown'))).status,404);assert.equal((await handler(new Request(base+'evidence-atlas',{method:'POST'}))).status,405);
handler=edge('evidence-atlas',{env:{SUPABASE_URL:'https://db.test'},fetch:async()=>new Response('',{status:500})});assert.equal((await handler(new Request(base+'evidence-atlas/api/cases'))).status,503);
handler=edge('evidence-public-news',{fetch:async u=>{if(String(u).includes('gdelt'))throw Error('offline');return new Response('<rss><channel><item><title><![CDATA[Research & findings]]></title><link>https://www.bbc.com/news/test</link><pubDate>Sun, 18 Oct 2026 10:00:00 GMT</pubDate></item><item><title>Unsafe</title><link>javascript:alert(1)</link></item></channel></rss>');}});
r=await handler(new Request(base+'evidence-public-news?topic=world'));let data=await r.json();assert.equal(r.status,200);assert.equal(data.articles.length,1);assert.equal(data.articles[0].title,'Research & findings');assert.match(data.provider,/fallback/);assert.equal((await handler(new Request(base+'evidence-public-news?topic=__proto__'))).status,400);
handler=edge('evidence-public-news',{fetch:async()=>Response.json({articles:[{title:'Headline',url:'https://news.test/article',seendate:'20261018T123456Z'}]})});data=await(await handler(new Request(base+'evidence-public-news?topic=health'))).json();assert.equal(data.articles[0].first_seen,'2026-10-18T12:34:56Z');
handler=edge('evidence-translate');assert.equal((await handler(new Request(base+'evidence-translate',{method:'POST',body:'{}'}))).status,401);assert.equal((await(await handler(new Request(base+'evidence-translate'))).json()).configured,false);
let sent;handler=edge('evidence-translate',{env:{SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public-test',DEEPL_API_KEY:'test:fx'},fetch:async(u,opts)=>{if(String(u).includes('/auth/'))return Response.json({id:'cdfff424-d750-4f82-baa3-d17a6113af53'});sent=JSON.parse(opts.body);return Response.json({translations:[{text:'Hello world'}]});}});
const post=d=>new Request(base+'evidence-translate',{method:'POST',headers:{authorization:'Bearer test-jwt','content-type':'application/json'},body:JSON.stringify(d)});
assert.equal((await handler(post({text:'Hola mundo',source_language:'es',target_language:'en'}))).status,400);
data=await(await handler(post({text:'Hola mundo',source_language:'es',target_language:'en',consent:true}))).json();assert.equal(data.translation,'Hello world');assert.equal(data.review_status,'pending');assert.equal(sent.text[0],'Hola mundo');assert.equal(sent.preserve_formatting,true);
for(const file of ['index.html','workspace.html','homepage-v2-preview.html','discover.html','healing.html']){for(const [i,m] of [...fs.readFileSync(file,'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries())if(m[1].trim()&&!m[0].startsWith('<script type="module">'))new vm.Script(m[1],{filename:file+':script'+i});}
const source=fs.readFileSync('workspace.html','utf8');const csvFn=source.slice(source.indexOf('  function parseCsv(text)'),source.indexOf('  async function previewImport(file)'));const parse=vm.runInNewContext(csvFn+';parseCsv;');let rows=parse('\uFEFFtitle,summary\r\n"One, two","line 1\nline 2"\r\n');assert.equal(rows.length,2);assert.equal(rows[1][0],'One, two');assert.equal(rows[1][1],'line 1\nline 2');assert.throws(()=>parse('title\n"unclosed'));
assert.match(source,/state.owner!==OWNER_USER_ID/);assert.match(source,/@supabase\/supabase-js@2\.95\.3/);
console.log('PASS: case API routing and published filter; error/method handling; RSS fallback, safe links and timestamps; translation owner/consent/configuration; original preservation; frontend syntax; CSV quoting and malformed input.');

const healing=fs.readFileSync('healing.html','utf8');const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,{textContent:'',value:'',disabled:false});return elements.get(id);};const moods=['overwhelmed','low','restless','steady'].map(mood=>({dataset:{mood},setAttribute(k,v){this[k]=v},addEventListener(k,f){this[k]=f}}));
vm.runInNewContext([...healing.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)][0][1],{document:{getElementById:element,querySelectorAll:()=>moods,addEventListener(){}},Date,Math,String,setInterval:()=>1,clearInterval(){}});
moods[0].click();assert.equal(moods[0]['aria-pressed'],'true');assert.match(element('moodResponse').textContent,/put one thing down/);for(let i=0;i<5;i++)element('groundNext').onclick();assert.equal(element('groundNext').disabled,true);assert.match(element('groundTitle').textContent,/space for yourself/);element('groundReset').onclick();assert.equal(element('groundNext').disabled,false);element('quietToggle').onclick();assert.equal(element('quietToggle').textContent,'Pause');element('quietReset').onclick();assert.equal(element('quietTime').textContent,'01:00');element('reflectionText').value='test';element('clearReflection').onclick();assert.equal(element('reflectionText').value,'');assert.ok(!healing.includes('localStorage'));assert.ok(!healing.includes('sessionStorage'));assert.ok(!healing.includes('fetch('));assert.match(healing,/jovianarchive.com\/pages\/get-your-human-design-chart/);console.log('PASS: Healing check-in, grounding steps/reset, timer, reflection clearing, no page persistence or outgoing text requests.');
// Assistant: no provider calls without opt-in and consent; published excerpts only.
const chatEnv={SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'server',OPENAI_API_KEY:'provider',EVIDENCE_AI_PUBLIC_ENABLED:'true'};
const chatPost=d=>new Request(base+'evidence-chat',{method:'POST',body:JSON.stringify(d)});
let providerCalls=0,budget=true,providerOK=true,providerBody;
const chatFetch=async(u,opts)=>{if(String(u).includes('evidence-research'))return Response.json({matches:{cases:[{id:7,title:'Published case',summary:'Documented finding.',official_finding:'Confirmed'}],documents:[{title:'Unsafe link',url:'javascript:alert(1)'}]}});if(String(u).includes('/rpc/'))return Response.json(budget);if(String(u).includes('api.openai.com')){providerCalls++;providerBody=JSON.parse(opts.body);return providerOK?Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({answer:'The published finding is documented.',source_ids:['C1']})}]}]}):new Response('',{status:429});}throw Error('Unexpected fetch');};
handler=edge('evidence-chat',{env:chatEnv,fetch:chatFetch});
assert.equal((await handler(chatPost({question:'a'}))).status,400);
data=await(await handler(chatPost({question:'Published case'}))).json();assert.equal(data.ai_generation,false);assert.equal(providerCalls,0);assert.equal(data.sources[1].url,null);
assert.equal((await handler(chatPost({question:'Published case',ai:true}))).status,400);
data=await(await handler(chatPost({question:'Published case',ai:true,consent:true}))).json();assert.equal(data.ai_generation,true);assert.equal(data.sources.length,1);assert.equal(providerBody.store,false);assert.equal(providerBody.max_output_tokens,700);assert.match(providerBody.input,/Documented finding/);
budget=false;data=await(await handler(chatPost({question:'Published case',ai:true,consent:true}))).json();assert.equal(data.ai_generation,false);assert.equal(providerCalls,1);
budget=true;providerOK=false;data=await(await handler(chatPost({question:'Published case',ai:true,consent:true}))).json();assert.equal(data.ai_generation,false);assert.match(data.notice,/temporarily unavailable/);
handler=edge('evidence-chat');assert.equal((await(await handler(new Request(base+'evidence-chat'))).json()).ai_available,false);data=await(await handler(chatPost({question:'Healing support'}))).json();assert.equal(data.mode,'site_guide');assert.equal(data.ai_generation,false);
new vm.Script(fs.readFileSync('assistant.js','utf8'));
console.log('PASS: assistant input validation, consent, source-safe links, no-key mode, grounded AI contract, aggregate budget denial and provider fallback.');
// Constructive reporting never silently falls back to unrelated general news.
handler=edge('evidence-public-news',{fetch:async u=>{if(String(u).includes('reasonstobecheerful'))throw Error('one feed unavailable');return new Response('<rss><channel><item><title>Local repair project</title><link>https://www.positive.news/test</link><dc:creator><![CDATA[A Reporter]]></dc:creator><pubDate>Mon, 19 Oct 2026 07:00:00 GMT</pubDate></item><item><title>Unsafe</title><link>javascript:alert(1)</link></item></channel></rss>');}});
data=await(await handler(new Request(base+'evidence-public-news?topic=positive'))).json();assert.equal(data.mode,'constructive_reporting_discovery');assert.equal(data.articles.length,1);assert.equal(data.articles[0].author,'A Reporter');assert.equal(data.sources[1].status,'unavailable');assert.equal(data.provider,'Positive News RSS');
handler=edge('evidence-public-news',{fetch:async()=>new Response('',{status:503})});r=await handler(new Request(base+'evidence-public-news?topic=positive'));assert.equal(r.status,503);data=await r.json();assert.equal(data.sources.length,2);assert.equal(data.articles.length,0);
console.log('PASS: positive-progress bylines, safe URLs, partial feed failure, and explicit total unavailability without unrelated fallback.');


const rabbitHole = fs.readFileSync('rabbit-hole.html','utf8');
for (const target of ['./paper-trails.html','./evidence-board.html','./connection-explorer.html#contribute']) {
  assert.ok(rabbitHole.includes('href="'+target+'"'), 'Missing Rabbit Hole evidence path: '+target);
  assert.ok(fs.existsSync(target.split('#')[0].slice(2)), 'Missing linked research page: '+target);
}
assert.match(rabbitHole,/Board lines represent indexed citations, not proof/);
assert.match(rabbitHole,/private draft tool does not publish, review, or add proposed links/);
assert.match(fs.readFileSync('connection-explorer.html','utf8'),/id="contribute"/);
console.log('PASS: Rabbit Hole links to published cases, source-backed Evidence Board and private draft explorer without implying unverified causal links.');

// Proposed relationship semantics are a review guide, not declarations about existing edges.
assert.equal((rabbitHole.match(/id="relationship-review-guide"/g)||[]).length,1);
assert.match(rabbitHole,/<summary><strong>How to evaluate a proposed connection<\/strong>/);
assert.match(rabbitHole,/review guide, not live graph labels/);
for (const label of ['Documented relationship','Thematic similarity','Investigator hypothesis','Contradicted link']) {
  assert.match(rabbitHole,new RegExp('<dt><strong>'+label+'<\\/strong><\\/dt>'));
}
assert.match(rabbitHole,/Existing citation edges are research references, not automatically verified connections/);
assert.match(rabbitHole,/Missing evidence alone is not proof that a link is false/);
assert.match(rabbitHole,/Do not present a citation as a documented relationship/);
console.log('PASS: Rabbit Hole relationship legend names all four review categories and does not promote source citations to findings.');

// Identity/provenance guard: canonical historical program and unverified theory stay distinct.
const bluebirdPage = fs.readFileSync('rabbit-hole.html','utf8');
assert.equal((bluebirdPage.match(/id="bluebird-bluebeam"/g)||[]).length,1);
assert.match(bluebirdPage,/Project BLUEBIRD is not Project Blue Beam/);
assert.match(bluebirdPage,/DOCUMENTED · CIA PROGRAM/);
assert.match(bluebirdPage,/UNVERIFIED · RESEARCH HYPOTHESIS/);
assert.match(bluebirdPage,/href="\.\/paper-trails\.html#case-3"/);
assert.doesNotMatch(bluebirdPage,/href="\.\/paper-trails\.html#case-32"/);
assert.match(bluebirdPage,/Case #31 \(record ID 32\).*index cross-reference/);
assert.match(bluebirdPage,/nsarchive\.gwu\.edu\/document\/32717-document-02/);
assert.match(bluebirdPage,/No public relationship edge is created here/);
assert.match(bluebirdPage,/not a documented link or evidence of coordination/);
assert.match(bluebirdPage,/target="_blank" rel="noopener noreferrer"/);
console.log('PASS: BLUEBIRD canonical case and Blue Beam hypothesis remain distinct; archival link and non-causal guard present.');

// Documented BLUEBIRD→ARTICHOKE rename remains distinct from the Blue Beam theory.
assert.equal((bluebirdPage.match(/id="bluebird-artichoke"/g)||[]).length,1);
assert.match(bluebirdPage,/Documented historical link/);
assert.match(bluebirdPage,/Project BLUEBIRD was renamed Project ARTICHOKE/);
assert.match(bluebirdPage,/August 1951/);
assert.match(bluebirdPage,/href="\.\/paper-trails\.html#case-4"/);
assert.doesNotMatch(bluebirdPage,/href="\.\/paper-trails\.html#case-33"/);
assert.match(bluebirdPage,/C01434878/);
assert.match(bluebirdPage,/released 2017\/01\/18/);
assert.match(bluebirdPage,/incomplete and fragmentary project records/);
assert.match(bluebirdPage,/does not establish any connection with Project Blue Beam/);
// The 1975 CIA PDF may redirect; an independently transcribed reading aid must never masquerade as the scan.
assert.equal((bluebirdPage.match(/id="cia-1975-access-note"/g)||[]).length,1);
assert.match(bluebirdPage,/CIA-hosted C01434878 PDF has redirected to the Reading Room homepage/);
assert.match(bluebirdPage,/href="https:\/\/www\.psychedelicarchive\.com\/archive\/cia-rd-testing-behavioral-drugs-1975-memo"/);
assert.match(bluebirdPage,/independent transcript of the 1975 CIA memorandum/);
assert.match(bluebirdPage,/third-party transcription is not the original scanned record/);
assert.match(bluebirdPage,/BLUEBIRD\/ARTICHOKE section, paragraph 4/);
assert.match(bluebirdPage,/href="https:\/\/www\.psychedelicarchive\.com[^"]+" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"/);
// An additional CIA archival report corroborates the name change without adding an alleged operation or graph edge.
assert.equal((bluebirdPage.match(/id="cia-1977-archive-note"/g)||[]).length,1);
assert.match(bluebirdPage,/CIA-RDP81-00261R000300050005-3/);
assert.match(bluebirdPage,/approved for release 2002\/05\/01/);
assert.match(bluebirdPage,/section IV, also dates the BLUEBIRD-to-ARTICHOKE name change to August 1951/);
assert.match(bluebirdPage,/later inventory-based summary/);
assert.match(bluebirdPage,/not a 1951 operational log/);
assert.match(bluebirdPage,/establishes no Project Blue Beam link/);
assert.match(bluebirdPage,/href="https:\/\/www\.cia\.gov\/readingroom\/docs\/CIA-RDP81-00261R000300050005-3\.pdf" target="_blank" rel="noopener noreferrer"/);
assert.match(bluebirdPage,/PDF; may redirect/);
console.log('PASS: CIA-documented BLUEBIRD to ARTICHOKE continuity is traceable; fallback transcript is explicitly secondary and no false link is promoted.');

// Shared investigation navigation opens exact canonical records, not index cross-references.
for (const [caseId, name] of [['3','BLUEBIRD'],['4','ARTICHOKE']]) {
  assert.match(bluebirdPage,new RegExp('href="\\.\\/connection-explorer\\.html#case='+caseId+'"'));
  assert.match(bluebirdPage,new RegExp('Inspect '+name+' source connections'));
}
for (const duplicateId of ['32','33']) {
  assert.doesNotMatch(bluebirdPage,new RegExp('href="\\.\\/connection-explorer\\.html#case='+duplicateId+'"'));
}
const explorerDeepLink = fs.readFileSync('connection-explorer.html','utf8');
assert.match(explorerDeepLink,/new URLSearchParams\(location\.hash\.slice\(1\)\)\.get\('case'\)/);
assert.match(explorerDeepLink,/byId\.get\(String\(hash\)\)/);
assert.match(bluebirdPage,/shared subject or source does not establish coordination or causation/i);
console.log('PASS: Rabbit Hole offers exact BLUEBIRD/ARTICHOKE Explorer deep links without duplicate cases or causal inference.');


