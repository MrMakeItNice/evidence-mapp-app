import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

// Generic research wording must not add unrelated citations to an AI's context.
const fixtures={
 cases:[
  {id:1,title:'MKULTRA',summary:'CIA behavioral research.',official_finding:'Documented in congressional records.'},
  {id:2,title:'Unrelated operation',summary:'A documented case with evidence and records.',official_finding:'Documented.'},
 ],
 sources:[
  {id:11,title:'Senate MKULTRA hearing',public_notes:'Original hearing transcript.'},
  {id:12,title:'Unrelated hearing',public_notes:'Documented evidence and records.'},
 ],
 problem_areas:[
  {id:21,name:'Research ethics',description:'Questions raised by MKULTRA.'},
  {id:22,name:'Other work',description:'Documented evidence and records.'},
 ],
};
let handler;const requests=[];
const code=fs.readFileSync(new URL('../supabase/functions/evidence-research/index.ts',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'');
vm.runInNewContext(stripTypeScriptTypes(code),{
 Deno:{env:{get:key=>({SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public-test'})[key]},serve:fn=>handler=fn},
 URL,Request,Response,AbortSignal,console,
 fetch:async(input,options)=>{
  const url=new URL(input);requests.push(url);
  assert.equal(url.searchParams.get('published'),'eq.true');
  assert.equal(options.headers.apikey,'public-test');
  const records=fixtures[url.pathname.split('/').pop()];
  assert.ok(records,'Only the three public evidence collections may be read');
  return Response.json(records);
 },
});
async function search(question){
 const response=await handler(new Request('https://example.test/?q='+encodeURIComponent(question)));
 assert.equal(response.status,200);
 return response.json();
}
for(const question of ['MKULTRA','What is documented about MKULTRA?','What evidence is known about MKULTRA?','Please explain the records about MKULTRA']){
 const data=await search(question);
 assert.deepEqual(data.matches.cases.map(row=>row.id),[1],question);
 assert.deepEqual(data.matches.documents.map(row=>row.id),[11],question);
 assert.deepEqual(data.matches.problem_areas.map(row=>row.id),[21],question);
 assert.equal(data.ai_generation,false);
}
for(const question of ['show me documented evidence','UnknownTopic987']){
 const data=await search(question);
 assert.equal(data.matches.cases.length+data.matches.documents.length+data.matches.problem_areas.length,0);
}
assert.equal(requests.length,18);
console.log('PASS: natural questions retain topic-specific citations; generic wording and unknown topics yield no invented matches; reads remain published-only and anonymous.');
