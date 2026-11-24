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
// Private drafting is local-browser persistence, not protected or anonymous storage.
const draftPrivacy = rabbitHole.match(/<p class="note" id="local-draft-safety">([\s\S]*?)<\/p>/);
assert.ok(draftPrivacy, 'Missing browser-local draft privacy warning');
for (const phrase of ['browser profile', 'not encrypted', 'shared device', 'Delete drafts', 'exported copies']) {
  assert.ok(draftPrivacy[1].includes(phrase), 'Draft privacy caveat missing: '+phrase);
}
const explorerDrafts = fs.readFileSync('connection-explorer.html','utf8');
assert.match(explorerDrafts,/localStorage\.getItem\(draftKey/);
assert.match(explorerDrafts,/localStorage\.setItem\(draftKey/);
assert.match(draftPrivacy[1],/not submitted to the public evidence graph/);
console.log('PASS: local draft disclosure matches Connection Explorer persistence and warns shared-device researchers.');

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
assert.match(bluebirdPage,/A theory associated with Canadian writer Serge Monast in the 1990s/);
assert.match(bluebirdPage,/href="https:\/\/www\.theguardian\.com\/us-news\/2024\/dec\/17\/drones-new-jersey-fbi" target="_blank" rel="noopener noreferrer"/);
assert.match(bluebirdPage,/secondary reporting about a claim/);
assert.match(bluebirdPage,/not evidence that the alleged operation existed/);
assert.match(bluebirdPage,/href="\.\/connection-explorer\.html#contribute">Draft an unverified connection privately \(not a public graph edge\)<\/a>/);
assert.match(bluebirdPage,/href="\.\/paper-trails\.html#case-3"/);
assert.doesNotMatch(bluebirdPage,/href="\.\/paper-trails\.html#case-32"/);
assert.match(bluebirdPage,/Case #31 \(record ID 32\).*index cross-reference/);
assert.match(bluebirdPage,/nsarchive\.gwu\.edu\/document\/32717-document-02/);
assert.match(bluebirdPage,/No public relationship edge is created here/);
assert.match(bluebirdPage,/the separate Project Blue Beam hypothesis have similar names/);
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
assert.match(bluebirdPage,/Attempt CIA PDF \(1975 memorandum; released 2017\/01\/18; C01434878; may redirect\)/);
assert.match(bluebirdPage,/href="#senate-1977-source-note">View separate Senate evidence for the August 1951 rename \(not a copy of the 1975 CIA memo\)<\/a>/);
assert.doesNotMatch(bluebirdPage,/Read the February 5, 1975 CIA retrospective/);
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
// Avoid conflating the documented BLUEBIRD→ARTICHOKE rename with the Blue Beam hypothesis.
assert.equal((bluebirdPage.match(/id="bluebird-bluebeam-assessment"/g)||[]).length,1);
assert.match(bluebirdPage,/BLUEBIRD versus Blue Beam — name resemblance, not a verified thematic link/);
assert.match(bluebirdPage,/That alone does not demonstrate a shared operation, method, or subject-matter connection/);
assert.match(bluebirdPage,/Documented relationship \(different pair\)/);
assert.match(bluebirdPage,/href="#senate-1977-source-note">source-backed BLUEBIRD → ARTICHOKE rename<\/a>/);
assert.match(bluebirdPage,/a proposed BLUEBIRD–Blue Beam connection would require direct evidence, alternatives and counterevidence before review/);
assert.match(bluebirdPage,/<strong>Thematic similarity:<\/strong> no shared method or coordinated activity/);
assert.match(bluebirdPage,/name resemblance alone is not a thematic evidence edge/);
assert.match(bluebirdPage,/<strong>Investigator hypothesis:<\/strong>/);
assert.match(bluebirdPage,/<strong>Contradicted link:<\/strong> none is affirmatively established by this review/);
assert.match(bluebirdPage,/lack of supporting evidence alone does not prove a claim false/);
assert.doesNotMatch(bluebirdPage,/BLUEBIRD versus Blue Beam — thematic similarity only/);
assert.doesNotMatch(bluebirdPage,/These entries share suggestive wording and broad themes only/);
console.log('PASS: BLUEBIRD/Blue Beam thematic comparison cannot be mistaken for documented BLUEBIRD-to-ARTICHOKE continuity.');

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

// Reviewed-source fallback: cite an existing Senate source in both canonical cases, not a new graph edge.
assert.equal((bluebirdPage.match(/id="senate-1977-source-note"/g)||[]).length,1);
assert.match(bluebirdPage,/Congressional record already indexed as source #258/);
assert.match(bluebirdPage,/August 3, 1977/);
assert.match(bluebirdPage,/Appendix A, section 2/);
assert.match(bluebirdPage,/printed pp\. 67–68/);
assert.match(bluebirdPage,/source #258 cited by the canonical BLUEBIRD \(record ID 3\) and ARTICHOKE \(record ID 4\) Case Files/);
assert.match(bluebirdPage,/not a newly discovered operation, a reviewed causal edge, or evidence for Project Blue Beam/);
assert.match(bluebirdPage,/href="https:\/\/www\.intelligence\.senate\.gov\/wp-content\/uploads\/2024\/08\/sites-default-files-hearings-95mkultra\.pdf#page=70" target="_blank" rel="noopener noreferrer"/);
assert.match(bluebirdPage,/PDF URL without the viewer-only page fragment matches existing source-library record #258/);
assert.match(bluebirdPage,/Canonical Case IDs 3 and 4 cite this record through generic research references \(relationship IDs 3 and 6\), not reviewed causal edges/);
assert.match(bluebirdPage,/printed pp\. 67–68; PDF viewer pp\. 70–71/);
assert.match(bluebirdPage,/Some PDF viewers may ignore the page fragment/);
assert.doesNotMatch(bluebirdPage,/href="https:\/\/www\.intelligence\.senate\.gov\/sites\/default\/files\/hearings\/95mkultra\.pdf"/);
// The Senate hearing landing page and its PDF are one underlying hearing.
const senateIdentity = bluebirdPage.match(/<p id="senate-hearing-record-identity">([\s\S]*?)<\/p>/);
assert.ok(senateIdentity);
assert.equal((bluebirdPage.match(/id="senate-hearing-record-identity"/g)||[]).length,1);
assert.match(senateIdentity[1],/indexed sources #1 and #258/);
assert.match(senateIdentity[1],/href="https:\/\/www\.intelligence\.senate\.gov\/1977\/08\/03\/hearings-joint-hearing-subcommittee-health-and-scientific-research-committee-human-resources-project\/" target="_blank" rel="noopener noreferrer"/);
assert.match(senateIdentity[1],/same document indexed as source #258/);
assert.match(senateIdentity[1],/one underlying hearing, not two independent confirmations/);
assert.match(senateIdentity[1],/not a finding about Project Blue Beam/);
assert.match(senateIdentity[1],/Both source IDs remain unchanged pending editorial review/);

// Official GPO catalog is an alternate doorway to the same 1977 Senate hearing, not independent corroboration.
assert.match(bluebirdPage,/href="https:\/\/www\.govinfo\.gov\/app\/details\/CHRG-95shrg96408O" target="_blank" rel="noopener noreferrer"/);
assert.match(bluebirdPage,/another official access point for the August 3, 1977 Senate hearing, not a separate source or independent confirmation/);
assert.match(bluebirdPage,/page offsets may differ between scans/);
assert.equal((bluebirdPage.match(/CHRG-95shrg96408O/g)||[]).length,2,'Catalog identifier should appear only in URL and visible label');
console.log('PASS: reviewed 1977 Senate hearing section and existing source #258 provide original-document navigation without a duplicate program or public edge.');

// A congressional appendix can depend on an earlier agency record.
const senateDependency = bluebirdPage.match(/<p id="senate-1977-source-note" tabindex="-1">([\s\S]*?)<\/p>/);
assert.ok(senateDependency, 'Missing Senate source note');
assert.match(senateDependency[1], /Printed p\. 67, footnote 4/);
assert.match(senateDependency[1], /<em>Behavioral Drugs and Testing<\/em>, dated February 11, 1975/);
assert.match(senateDependency[1], /not necessarily independent corroboration/);
assert.match(senateDependency[1], /February 11, 1975 revision has now been located in CIA release C01434878/);
assert.match(senateDependency[1], /exact copy delivered to the Senate remains unverified/);
assert.match(senateDependency[1], /do not count the February 5 and 11 versions or the hearing excerpt as independent corroboration/);


// A third canonical case cites the same congressional record. Preserve source identity.
const mkultraSharedHearing = bluebirdPage.match(/<p id="mkultra-shared-hearing-note">([\s\S]*?)<\/p>/);
assert.ok(mkultraSharedHearing, 'Missing shared MKULTRA hearing note');
assert.equal((bluebirdPage.match(/id="mkultra-shared-hearing-note"/g)||[]).length,1);
assert.match(mkultraSharedHearing[1], /Source #258 is also indexed under the published MKULTRA Case #1 \(record ID 1; research reference #1\)/);
assert.match(mkultraSharedHearing[1], /href="\.\/paper-trails\.html#case-1"/);
assert.match(mkultraSharedHearing[1], /href="\.\/connection-explorer\.html#case=1"/);
assert.match(mkultraSharedHearing[1], /href="https:\/\/www\.intelligence\.senate\.gov\/wp-content\/uploads\/2024\/08\/sites-default-files-hearings-95mkultra\.pdf#page=7" target="_blank" rel="noopener noreferrer"/);
assert.match(mkultraSharedHearing[1], /printed p\. 3; PDF viewer p\. 7/);
assert.match(mkultraSharedHearing[1], /same hearing, not an additional independent source/);
assert.match(mkultraSharedHearing[1], /do not prove that programs were identical or establish a Project Blue Beam connection/);
const hearingRefsForMkultra = JSON.parse(fs.readFileSync('paper-trails-data.json','utf8')).references;
assert.ok(hearingRefsForMkultra.some(r => String(r.case_id)==='1' && String(r.source_id)==='258' && r.url==='https://www.intelligence.senate.gov/wp-content/uploads/2024/08/sites-default-files-hearings-95mkultra.pdf'));
console.log('PASS: MKULTRA canonical navigation shares existing hearing #258 without double-counting or inferring Blue Beam links.');




// MKULTRA and MKDELTA describe different administrative functions in one primary record.
const mkdeltaScope = bluebirdPage.match(/<p id="mkultra-mkdelta-scope" tabindex="-1">([\s\S]*?)<\/p>/);
assert.ok(mkdeltaScope);
assert.equal((bluebirdPage.match(/id="mkultra-mkdelta-scope"/g)||[]).length,1);
assert.match(mkdeltaScope[1],/Documented administrative relationship/);
assert.match(mkdeltaScope[1],/October 20, 1952.*April 3, 1953/);
assert.match(mkdeltaScope[1],/2019\/04\/03, C06767515/);
assert.match(mkdeltaScope[1],/MKUltra-IG_Report-ocr\.pdf#page=1" target="_blank" rel="noopener noreferrer"/);
assert.match(mkdeltaScope[1],/MKUltra-IG_Report-ocr\.pdf#page=3" target="_blank" rel="noopener noreferrer"/);
assert.match(mkdeltaScope[1],/not proof that any particular operation occurred or was effective/);
assert.match(mkdeltaScope[1],/not evidence for a Project Blue Beam connection/);
assert.match(mkdeltaScope[1],/The two pages are part of one record/);
assert.match(mkdeltaScope[1],/href="\.\/paper-trails\.html#case-1"/);
assert.match(mkdeltaScope[1],/href="\.\/connection-explorer\.html#case=1"/);
assert.match(mkdeltaScope[1],/no new case, source-library record or public relationship edge is created/);
console.log('PASS: MKULTRA/MKDELTA source scope uses one primary record and canonical navigation.');

// CHATTER is a source-backed thematic comparison, not a causal edge.
const chatterComparison = bluebirdPage.match(/<p id="chatter-thematic-comparison" tabindex="-1">([\s\S]*?)<\/p>/);
assert.ok(chatterComparison);
assert.equal((bluebirdPage.match(/id="chatter-thematic-comparison"/g)||[]).length,1);
assert.match(chatterComparison[1],/Thematic similarity, not a documented operational link/);
assert.match(chatterComparison[1],/U\.S\. Navy project running from 1947 to 1953/);
assert.match(chatterComparison[1],/printed p\. 67; PDF viewer p\. 70/);
assert.match(chatterComparison[1],/does not establish shared command, joint operations or a Project Blue Beam connection/);
assert.match(chatterComparison[1],/one underlying hearing, not independent corroboration/);
assert.match(chatterComparison[1],/href="\.\/paper-trails\.html#case-5"/);
assert.match(chatterComparison[1],/href="\.\/connection-explorer\.html#case=5"/);
assert.match(chatterComparison[1],/href="https:\/\/www\.intelligence\.senate\.gov\/wp-content\/uploads\/2024\/08\/sites-default-files-hearings-95mkultra\.pdf#page=70" target="_blank" rel="noopener noreferrer"/);
assert.match(chatterComparison[1],/no new public relationship edge is created/);
assert.ok(JSON.parse(fs.readFileSync('paper-trails-data.json','utf8')).references.some(r => String(r.case_id)==='5' && String(r.source_id)==='258' && r.url==='https://www.intelligence.senate.gov/wp-content/uploads/2024/08/sites-default-files-hearings-95mkultra.pdf'));
console.log('PASS: CHATTER thematic comparison uses existing case and congressional source without inferring operational links.');

// Contemporaneous counterevidence must preserve the difference between a broad claim and a limited file search.
const artichokeCounterevidence = bluebirdPage.match(/<p id="artichoke-1952-counterevidence" tabindex="-1">([\s\S]*?)<\/p>/);
assert.ok(artichokeCounterevidence);
assert.equal((bluebirdPage.match(/id="artichoke-1952-counterevidence"/g)||[]).length,1);
assert.match(artichokeCounterevidence[1],/July 14, 1952/);
assert.match(artichokeCounterevidence[1],/John Marks Collection, Box 6, document 06/);
assert.match(artichokeCounterevidence[1],/Artichoke-ocr\.pdf#page=1" target="_blank" rel="noopener noreferrer"/);
assert.match(artichokeCounterevidence[1],/counterevidence to the broad hypothetical claim/);
assert.match(artichokeCounterevidence[1],/does not contradict the narrower 1975 statement/);
assert.match(artichokeCounterevidence[1],/not independent validation of efficacy/);
assert.match(artichokeCounterevidence[1],/original declassification date is not established/);
assert.match(artichokeCounterevidence[1],/canonical ARTICHOKE Case #3 \(record ID 4\), pending editorial review/);
assert.match(artichokeCounterevidence[1],/not a newly indexed source or a Project Blue Beam connection/);
console.log('PASS: 1952 ARTICHOKE counterevidence is scoped to the documented report, not a Blue Beam relationship.');

// Keep primary-source and uncertainty notes discoverable from the BLUEBIRD/Blue Beam comparison.
const sourceJumpNav = bluebirdPage.match(/<nav class="source-jumps" aria-label="Evidence notes and relationship comparisons">([\s\S]*?)<\/nav>/);
assert.ok(sourceJumpNav, 'Missing source-scope navigation landmark');
const sourceJumpLinks = [...sourceJumpNav[1].matchAll(/<a href="#([^"]+)">([^<]+)<\/a>/g)];
assert.deepEqual(sourceJumpLinks.map(link => link[1]), [
  'cia-1975-indexed-source-note',
  'senate-1977-source-note',
  'mkultra-mkdelta-scope',
  'chatter-thematic-comparison',
  'mksearch-program-continuity',
  'often-chickwit-program-distinction',
  'source-scope-comparison',
  'artichoke-1952-counterevidence',
  'northwoods-mongoose-scope',
  'mongoose-approval-markers',
  'bluebird-bluebeam-assessment'
]);
assert.ok(sourceJumpLinks.every(link => link[2].length >= 16), 'Source jumps need descriptive names');
for (const link of sourceJumpLinks) {
  assert.equal((bluebirdPage.match(new RegExp('id="'+link[1]+'"','g')) || []).length,1,'Every jump must have exactly one existing target');
}
assert.match(bluebirdPage,/\.source-jumps a\{[^}]*min-height:44px/);
assert.match(bluebirdPage,/\.source-jumps a:focus-visible\{[^}]*outline:3px/);
// In-page source-jump destinations are visually identifiable and focusable without
// adding extra sequential tab stops. These static checks do not replace browser QA.
assert.deepEqual(sourceJumpLinks.slice(0,2).map(link => link[2]), [
  '1975 CIA file review · source #212',
  '1977 Senate hearing · source #258'
]);
for (const id of sourceJumpLinks.map(link => link[1])) {
  assert.match(bluebirdPage, new RegExp('id="'+id+'" tabindex="-1"'));
  assert.match(bluebirdPage, new RegExp('#'+id+':target'));
}
assert.match(bluebirdPage, /:target\{outline:3px solid #0b8671;outline-offset:4px;background:#eefaf5\}/);

assert.deepEqual(sourceJumpLinks.slice(2,4).map(link => link[2]), [
  'MKULTRA / MKDELTA · documented administrative link',
  'CHATTER · thematic similarity only'
]);
console.log('PASS: evidence notes, relationship comparisons and Blue Beam assessment have unique accessible 44px jump links.');

// Direct links, browser history, and repeat in-page jumps must reveal a closed
// comparison panel; other hashes must not override the visitor's chosen state.
const comparisonScripts = [...bluebirdPage.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.equal(comparisonScripts.length, 1, 'Expected one isolated Rabbit Hole navigation script');
new vm.Script(comparisonScripts[0][1], {filename:'rabbit-hole.html:source-comparison'});
const comparisonPanel = {open:false};
const fakeHash = {hash:'#artichoke-1952-counterevidence'};
const handlers = {};
vm.runInNewContext(comparisonScripts[0][1], {
  document: {
    getElementById: id => id === 'source-scope-comparison' ? comparisonPanel : null,
    querySelectorAll: selector => ['a[href="#source-scope-comparison"]', 'a[href="#artichoke-1952-counterevidence"]'].includes(selector)
      ? [{addEventListener: (kind, fn) => { handlers[selector + ':' + kind] = fn; }}] : []
  },
  window: {
    location:fakeHash,
    addEventListener:(kind, fn) => { handlers[kind] = fn; }
  }
});
assert.equal(comparisonPanel.open,true,'Direct deep link must expand source comparison');
comparisonPanel.open=false;
fakeHash.hash='#bluebird-bluebeam-assessment';
handlers.hashchange();
assert.equal(comparisonPanel.open,false,'Unrelated anchors must not reopen comparison');
fakeHash.hash='#source-scope-comparison';
handlers.hashchange();
assert.equal(comparisonPanel.open,true,'History navigation must expand comparison');
comparisonPanel.open=false;
handlers['a[href="#source-scope-comparison"]:click']();
assert.equal(comparisonPanel.open,true,'Clicking an unchanged hash must expand comparison');
comparisonPanel.open=false;
fakeHash.hash='#artichoke-1952-counterevidence';
handlers.hashchange();
assert.equal(comparisonPanel.open,true,'History must reveal nested counterevidence');
comparisonPanel.open=false;
handlers['a[href="#artichoke-1952-counterevidence"]:click']();
assert.equal(comparisonPanel.open,true,'Repeat counterevidence jump must expand comparison');
console.log('PASS: source-scope comparison opens for direct/history/repeat jumps without changing unrelated navigation.');

// Investigation path cards use semantic, full-card links, not tiny heading-only tap targets.
const pathNav = rabbitHole.match(/<nav class="grid" aria-label="Research paths from theories to documented Case Files">([\s\S]*?)<\/nav>/);
assert.ok(pathNav, 'Missing labeled investigation navigation landmark');
const pathLinks = [...pathNav[1].matchAll(/<a class="tile research-path" href="([^"]+)"><h3>([^<]+)<\/h3><p>([^<]+)<\/p><\/a>/g)];
assert.equal(pathLinks.length, 3, 'All three investigation tiles must be whole-card links');
assert.deepEqual(pathLinks.map(item => item[1]), [
  './paper-trails.html', './evidence-board.html', './connection-explorer.html#contribute'
]);
assert.ok(pathLinks.every(item => item[3].length > 35), 'Links must explain evidence limits and destination');
assert.match(rabbitHole, /\.research-path\{[^}]*min-height:88px/);
assert.match(rabbitHole, /\.research-path:focus-visible\{[^}]*outline:3px/);
console.log('PASS: Rabbit Hole investigation paths offer full-tile touch/keyboard links with clear scope and provenance limits.');


// An already indexed CIA retrospective is visible as a single shared record, with a
// document-specific negative finding and no accidental Blue Beam or rename inference.
const indexedSource212 = bluebirdPage.match(/<p id="cia-1975-indexed-source-note" tabindex="-1">([\s\S]*?)<\/p>/);
assert.ok(indexedSource212, 'Missing the indexed 1975 CIA memorandum citation');
assert.match(indexedSource212[1],/Separate indexed CIA record — source #212/);
assert.match(indexedSource212[1],/dated January 31, 1975/);
assert.match(indexedSource212[1],/record ID 3; research reference #4/);
assert.match(indexedSource212[1],/record ID 4; research reference #5/);
assert.match(indexedSource212[1],/found no record of hypnosis used as an operational tool in the field among the files examined/);
assert.match(indexedSource212[1],/not two independent confirmations, proof of operational success, or evidence for Project Blue Beam/);
assert.match(indexedSource212[1],/does not itself date the August 1951 rename/);
assert.match(indexedSource212[1],/public-release date of this scan has not been independently verified/);
assert.match(indexedSource212[1],/href="https:\/\/nsarchive2\.gwu\.edu\/NSAEBB\/NSAEBB438\/st02\.pdf#page=1" target="_blank" rel="noopener noreferrer"/);
console.log('PASS: already indexed CIA source #212 links BLUEBIRD and ARTICHOKE without duplicate corroboration or Blue Beam promotion.');

// Compare two indexed official records without promoting apparent differences to a verified contradiction.
const sourceScopeComparison = bluebirdPage.match(/<details id="source-scope-comparison" tabindex="-1">([\s\S]*?)<\/details>/);
assert.ok(sourceScopeComparison, 'Missing collapsible source-scope comparison');
assert.equal((bluebirdPage.match(/id="source-scope-comparison"/g)||[]).length, 1);
for (const id of ['cia-1975-indexed-source-note', 'senate-1977-source-note']) {
  assert.match(sourceScopeComparison[1], new RegExp('href="#'+id+'"'));
  assert.equal((bluebirdPage.match(new RegExp('id="'+id+'"','g'))||[]).length, 1);
}
assert.match(sourceScopeComparison[1], /January 31, 1975 CIA file-review memo \(source #212, scan p\. 2\)/);
assert.match(sourceScopeComparison[1], /August 3, 1977 Senate hearing appendix \(source #258, printed p\. 68\)/);
assert.match(sourceScopeComparison[1], /different scopes and may rely on overlapping underlying files/);
assert.match(sourceScopeComparison[1], /not declaring a verified contradiction or independent corroboration/);
assert.match(sourceScopeComparison[1], /Neither establishes any Project Blue Beam connection or justifies a new public relationship edge/);
assert.match(bluebirdPage, /#source-scope-comparison summary:focus-visible\{outline:3px/);
console.log('PASS: CIA #212 and Senate #258 are compared with page-level scope limits, accessible disclosure, and no false contradiction or Blue Beam edge.');

// Archival catalog fallback preserves identity and uncertainty across versions.
const ciaArchiveFallback = bluebirdPage.match(/<p id="cia-1975-access-note">([\s\S]*?)<\/p>/);
assert.ok(ciaArchiveFallback, 'Missing CIA archive access note');
assert.match(ciaArchiveFallback[1], /href="https:\/\/archive\.org\/details\/cia-readingroom-document-01434878" target="_blank" rel="noopener noreferrer"/);
assert.match(ciaArchiveFallback[1], /same release, not an independent source/);
assert.match(ciaArchiveFallback[1], /PDF pages 2 and 4/);
assert.match(ciaArchiveFallback[1], /Internet Archive PDF download could not be verified/);
assert.match(ciaArchiveFallback[1], /href="https:\/\/organizedabuse\.support\/wp-content\/uploads\/2024\/10\/cia-rd-and-testing-of-behavioral-drugs\.pdf#page=3" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"/);
assert.match(ciaArchiveFallback[1], /viewer p\. 3 bears the date February 11, 1975 and is marked Revision/);
assert.match(ciaArchiveFallback[1], /printed p\. 2 \(viewer p\. 4\), paragraph 4/);
assert.match(ciaArchiveFallback[1], /Viewer pp\. 8–9 contain the February 5 version marked old/);
assert.match(ciaArchiveFallback[1], /exact copy transmitted to Congress and a checksum match to the official PDF are not established/);
assert.match(ciaArchiveFallback[1], /does not establish that all programs were one operation or that any connection to Blue Beam existed/);
assert.match(ciaArchiveFallback[1], /Do not count versions as independent corroboration/);
console.log('PASS: CIA archival catalog fallback is not independent corroboration and preserves version uncertainty.');

// Existing source #258 establishes program continuity without creating a new edge.
const mksearchContinuity = bluebirdPage.match(/<p id="mksearch-program-continuity" tabindex="-1">([\s\S]*?)<\/p>/);
assert.ok(mksearchContinuity);
assert.match(mksearchContinuity[1], /MKULTRA → MKSEARCH/);
assert.match(mksearchContinuity[1], /fiscal year 1966 through fiscal year 1972/);
assert.match(mksearchContinuity[1], /printed p\. 169; PDF viewer p\. 171/);
assert.match(mksearchContinuity[1], /95mkultra\.pdf#page=171" target="_blank" rel="noopener noreferrer"/);
assert.match(mksearchContinuity[1], /source #258\), not a new independent source/);
assert.match(mksearchContinuity[1], /Case #33 \(record ID 34\).*reference #56/);
assert.match(mksearchContinuity[1], /href="\.\/paper-trails\.html#case-34"/);
assert.match(mksearchContinuity[1], /href="\.\/connection-explorer\.html#case=34"/);
assert.match(mksearchContinuity[1], /not proof of any particular experiment's results, present-day continuation, or a Project Blue Beam connection/);
assert.match(mksearchContinuity[1], /No new case, source record or public graph edge is created/);
assert.ok(JSON.parse(fs.readFileSync('paper-trails-data.json','utf8')).references.some(r => String(r.case_id)==='34' && String(r.source_id)==='258' && r.url==='https://www.intelligence.senate.gov/wp-content/uploads/2024/08/sites-default-files-hearings-95mkultra.pdf'));
console.log('PASS: MKSEARCH continuity links the existing case and hearing without double-counting evidence or inferring a current operation.');

// One hearing documents different project roles, not two independent sources.
const oftenChickwit = bluebirdPage.match(/<p id="often-chickwit-program-distinction" tabindex="-1">([\s\S]*?)<\/p>/);
assert.ok(oftenChickwit);
assert.match(oftenChickwit[1], /1967 Office of Research and Development and Edgewood Arsenal research program divided into OFTEN/);
assert.match(oftenChickwit[1], /CHICKWIT \(collecting information on drug developments and acquiring samples\)/);
assert.match(oftenChickwit[1], /disagreement between the CIA and Department of Defense over financing and sponsorship/);
assert.match(oftenChickwit[1], /September 21, 1977 hearing; this note does not resolve that disagreement/);
assert.match(oftenChickwit[1], /95mkultra\.pdf#page=171" target="_blank" rel="noopener noreferrer"/);
assert.match(oftenChickwit[1], /single hearing \(source #258\)/);
assert.match(oftenChickwit[1], /does not establish that these projects were identical to MKSEARCH/);
assert.match(oftenChickwit[1], /or establish efficacy, current operations or a Project Blue Beam connection/);
assert.match(oftenChickwit[1], /No new case, source record or public graph edge is created/);
for (const [caseId, caseNumber, reference] of [[36,35,61],[37,36,63]]) {
  assert.ok(oftenChickwit[1].includes('Case #'+caseNumber+' (record ID '+caseId+')'));
  assert.ok(oftenChickwit[1].includes('href="./paper-trails.html#case-'+caseId+'"'));
  assert.ok(oftenChickwit[1].includes('href="./connection-explorer.html#case='+caseId+'"'));
  assert.ok(oftenChickwit[1].includes('generic research reference #'+reference));
  assert.ok(JSON.parse(fs.readFileSync('paper-trails-data.json','utf8')).references.some(r => String(r.case_id)===String(caseId) && String(r.source_id)==='258' && r.url==='https://www.intelligence.senate.gov/wp-content/uploads/2024/08/sites-default-files-hearings-95mkultra.pdf'));
}
console.log('PASS: OFTEN and CHICKWIT reuse the original hearing and preserve the unresolved sponsorship discrepancy.');


 // The September follow-up is an indexed hearing, not a new case or resolved dispute.
const septemberHearingUrl = "https://www.prisonlegalnews.org/news/publications/human-drug-testing-by-the-cia-1977-hearings-before-us-senate/";
assert.ok(oftenChickwit[1].includes('Follow-up hearing — existing source #279:'));
assert.ok(oftenChickwit[1].includes('href="'+septemberHearingUrl+'" target="_blank" rel="noopener noreferrer"'));
assert.match(oftenChickwit[1], /September 21 testimony, printed pp\. 126–130/);
assert.match(oftenChickwit[1], /machine-read text and a link to the original scan; the scan could not be visually checked here/);
assert.match(oftenChickwit[1], /Verify the printed pages before relying on exact wording/);
assert.match(oftenChickwit[1], /separate hearing from source #258/);
assert.match(oftenChickwit[1], /generic research references #57, #60 and #62/);
assert.match(oftenChickwit[1], /not three independent confirmations or evidence of a Blue Beam relationship/);
for (const id of ['34','36','37']) {
  assert.ok(JSON.parse(fs.readFileSync('paper-trails-data.json','utf8')).references.some(r => String(r.case_id)===id && String(r.source_id)==='279' && r.url===septemberHearingUrl));
}
console.log('PASS: September hearing follow-up uses indexed provenance and preserves scan-verification caveat.');


const chickwitIdentityNote = bluebirdPage.match(/<strong>Case identity note — CHICKWIT:<\/strong>([\s\S]*?)This is a separate hearing/);
assert.ok(chickwitIdentityNote, 'CHICKWIT naming clarification must remain next to the source #279 follow-up');
assert.match(chickwitIdentityNote[1], /printed p\. 126, CIA witness Gordon identifies the project name as CHICKWIT without the MK prefix/);
assert.match(chickwitIdentityNote[1], /attributed testimony, not independent proof of the absence of testing/);
assert.match(chickwitIdentityNote[1], /MKCHICKWIT \/ CHICKWIT refers to the same Case #36 \(record ID 37\)/);
assert.match(chickwitIdentityNote[1], /search alias for editorial review, not a separate case/);
assert.match(chickwitIdentityNote[1], /two access points to source #279, not independent sources/);
assert.match(oftenChickwit[1], /href="https:\/\/www\.prisonlegalnews\.org\/media\/publications\/human_drug_testing_by_the_cia_1977_hearings_before_us_senate\.pdf" target="_blank" rel="noopener noreferrer"/);
assert.match(oftenChickwit[1], /scan could not be visually checked here/);
console.log('PASS: CHICKWIT testimony clarifies naming without a new case, duplicate source or stronger evidence claim.');


// The archival alias is an existing source, not a new case or evidence edge.
const chickwitFoiaAlias = bluebirdPage.match(/<p id="chickwit-foia-alias-review">([\s\S]*?)<\/p>/);
assert.ok(chickwitFoiaAlias);
assert.equal(bluebirdPage.split('id="chickwit-foia-alias-review"').length, 2);
assert.match(chickwitFoiaAlias[1], /existing source #35 \(review pending\)/);
assert.match(chickwitFoiaAlias[1], /February 1, 2013 \(F-2013-00528; approval-for-release marking 2021\/10\/22, C05956999; page 1\)/);
assert.match(chickwitFoiaAlias[1], /Final%20Letter%5B15992821%5D\.pdf" target="_blank" rel="noopener noreferrer"/);
assert.match(chickwitFoiaAlias[1], /scan retrieval redirected to the Reading Room; visual verification and the referenced enclosure remain outstanding/);
assert.match(chickwitFoiaAlias[1], /not a contemporaneous operational record/);
assert.match(chickwitFoiaAlias[1], /href="\.\/paper-trails\.html#case-37"/);
assert.match(chickwitFoiaAlias[1], /href="\.\/connection-explorer\.html#case=37"/);
assert.match(chickwitFoiaAlias[1], /no graph reference to it was found in the relationship table/);
assert.match(chickwitFoiaAlias[1], /Do not infer project activity, testing, independent corroboration of an experiment, or a Blue Beam connection/);
assert.match(chickwitFoiaAlias[1], /No new case, source record or public graph edge is created/);
console.log("PASS: CHICKWIT archive alias reuses source #35 and preserves archival access and evidence limitations.");


const northwoodsScope = bluebirdPage.match(/<p class="note" id="northwoods-mongoose-scope" tabindex="-1">([\s\S]*?)<\/p>/);
assert.ok(northwoodsScope, 'Northwoods planning context must be separately labeled');
for (const phrase of ['preliminary planning submission','JCS 1969/321','existing source #28, library review pending','FRUS document 314, existing source #191','not authorization or execution of the Northwoods proposals','not reviewed causal edges','No shared operation with BLUEBIRD or Blue Beam','No new case, source record or public graph edge is created']) {
  assert.ok(northwoodsScope[1].includes(phrase), 'Missing scope safeguard: '+phrase);
}
for (const caseId of ['21','22']) {
  assert.ok(northwoodsScope[1].includes('href="./paper-trails.html#case-'+caseId+'"'));
  assert.ok(northwoodsScope[1].includes('href="./connection-explorer.html#case='+caseId+'"'));
}
assert.ok(northwoodsScope[1].includes('href="https://nsarchive2.gwu.edu/news/20010430/northwoods.pdf#page=1" target="_blank" rel="noopener noreferrer"'));
assert.ok(northwoodsScope[1].includes('href="https://history.state.gov/historicaldocuments/frus1961-63v10/d314" target="_blank" rel="noopener noreferrer"'));
console.log('PASS: Northwoods and Mongoose links reuse canonical cases and distinguish preliminary planning from approval or execution.');


for (const phrase of ['#32, #33, #34 and #35','March 16','advance approval required','separately from contingency planning','the July 24 scan has not been independently checked','do not count the two reports as independent corroboration','Neither establishes execution of the Northwoods proposals','candidate sources for review','not new library entries or evidence for Blue Beam']) {
  assert.ok(northwoodsScope[1].includes(phrase), 'Missing Phase I evidence safeguard: '+phrase);
}
for (const doc of ['359','360']) {
  assert.ok(northwoodsScope[1].includes('href="https://history.state.gov/historicaldocuments/frus1961-63v10/d'+doc+'" target="_blank" rel="noopener noreferrer"'));
}
console.log('PASS: Mongoose Phase I reports distinguish authorization, activity and contingency planning without double-counting evidence.');


// Phase II framework authorization does not approve every proposed operation.
for (const phrase of ["August 17, 1962 Taylor memorandum","August 20, 1962","requiring approval of specific action schedules","separately requests approval to proceed with Phase II","Contradicted interpretation:","conflicts with document 380","does not establish that all covert activity was prohibited","Neither framework approval nor a later request establishes execution of Northwoods or a Blue Beam relationship","not independently inspected original scans or new library entries"]) {
  assert.ok(northwoodsScope[1].includes(phrase), 'Missing Phase II evidence safeguard: '+phrase);
}
for (const doc of ['380','423']) {
  assert.ok(northwoodsScope[1].includes('href="https://history.state.gov/historicaldocuments/frus1961-63v10/d'+doc+'" target="_blank" rel="noopener noreferrer"'));
}
console.log('PASS: Phase II framework approval and later requests remain distinct from execution and Blue Beam hypotheses.');

 // A scan and an edited transcription of one memorandum are not separate evidence.
for (const phrase of ['National Archives record 176-10011-10055','PDF viewer pp. 2–4, memorandum pp. 1–3','identification sheet and these three memorandum pages were visually checked','two versions of the same underlying memorandum, not independent confirmations','Punta del Este conference and Kennedy’s visit to Mexico','direct counterevidence to attributing those events to Mongoose planning merely because their objectives overlapped','does not establish that the events had no policy relationship','internal program assessment, not independent verification','remaining scan pages and precise release date have not been verified']) {
  assert.ok(northwoodsScope[1].includes(phrase), 'Missing archival provenance safeguard: '+phrase);
}
assert.ok(northwoodsScope[1].includes('href="https://www.archives.gov/files/research/jfk/releases/2018/176-10011-10055.pdf#page=2" target="_blank" rel="noopener noreferrer"'));
console.log('PASS: July 25 Mongoose scan and FRUS transcription share document identity; explicit counterevidence is scoped.');

// The document's approval notation is scoped to this plan; not proof of execution.
const mongooseApprovalMarkers = bluebirdPage.match(/<p class="note" id="mongoose-approval-markers" tabindex="-1">([\s\S]*?)<\/p>/);
assert.ok(mongooseApprovalMarkers);
for (const phrase of ['March 13, 1962','asterisks identify activities already approved','further planning awaits policy decisions','note 2 dates the marked approvals to March 5, 1962','not a visually verified original scan','not proof of execution or a universal rule for other documents','does not establish its approval or execution','candidate source','No Project Blue Beam connection is demonstrated','No new case, source record or public graph edge is created']) {
  assert.ok(mongooseApprovalMarkers[1].includes(phrase), 'Missing approval scope: '+phrase);
}
for (const href of ['https://history.state.gov/historicaldocuments/frus1961-63v10-12mSupp/d280','./paper-trails.html#case-22','./connection-explorer.html#case=22','#northwoods-mongoose-scope']) {
  assert.ok(mongooseApprovalMarkers[1].includes('href="'+href+'"'));
}
assert.ok(mongooseApprovalMarkers[1].includes('target="_blank" rel="noopener noreferrer"'));
console.log('PASS: Mongoose plan approval notation has a scoped source and canonical navigation.');
