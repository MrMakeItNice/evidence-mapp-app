// Run: node --test tests/global-search-query-privacy.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const html = readFileSync(join(__dirname, '..', 'global-search.html'), 'utf8');

test('the search UI discloses external scholarly query transmission', () => {
  assert.match(html, /Submitting a search sends your terms to OpenAlex and Crossref/);
  assert.match(html, /Opening an external search link also sends your terms to that provider/);
  assert.match(html, /Avoid sensitive search terms/);
  assert.doesNotMatch(html, /External providers receive your query only when you open their link/);
});

test('prefilled query URLs do not automatically call scholarly providers', () => {
  assert.match(html, /const initial=new URLSearchParams\(location.search\).get\('q'\)/);
  assert.doesNotMatch(html, /if\(initial\)liveSearch\(initial\)/);
  assert.match(html, /if\(initial\)document.getElementById\('live-status'\).textContent=/);
});

test('explicit search still calls scholarly discovery with the submitted terms', () => {
  assert.match(html, /addEventListener\('submit',e=>\{e.preventDefault\(\);search\(q.value\)\}\)/);
  assert.match(html, /renderSources\(clean\|\|'public records'\);liveSearch\(clean\)/);
});

test('search field exposes the privacy disclosure as its accessible description', () => {
  assert.match(html, /<input id="q"[^>]*aria-describedby="search-privacy"/);
  assert.match(html, /<p class="hint" id="search-privacy">Submitting a search sends your terms to OpenAlex and Crossref/);
  assert.equal([...html.matchAll(/id="search-privacy"/g)].length, 1);
});

test('actual page sends no scholarly query on prefill or typing, then sends submitted terms', async () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = new Map(), calls = [];
  const element = () => ({children:[], value:'', textContent:'', handlers:{},
    append(...children){this.children.push(...children)},
    replaceChildren(...children){this.children=children},
    addEventListener(type,handler){this.handlers[type]=handler}});
  const get = id => { if(!nodes.has(id)) nodes.set(id,element()); return nodes.get(id) };
  const fetch = async url => {
    calls.push(String(url));
    return {ok:true,json:async()=>String(url).includes('/api/cases')?[]:String(url).includes('openalex')?{results:[]}:{message:{items:[]}}};
  };
  new Function('document','location','history','fetch','URL','URLSearchParams','AbortController','setTimeout','clearTimeout',script)(
    {getElementById:get,createElement:element},
    {search:'?q=prefilled',href:'https://atlas.example/global-search.html?q=prefilled'},
    {replaceState(){}},fetch,URL,URLSearchParams,AbortController,()=>1,()=>{});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(get('q').value,'prefilled');
  assert.match(get('live-status').textContent,/prefilled.*Submit/);
  assert.equal(calls.length,1); assert.match(calls[0],/\/api\/cases$/);
  get('q').value='submitted & current';
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.length,1);
  let prevented=false;
  get('search').handlers.submit({preventDefault(){prevented=true}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(prevented,true);assert.equal(calls.length,3);
  const scholarly=calls.filter(url=>/api\.(openalex|crossref)\.org/.test(url));
  assert.equal(scholarly.length,2);
  assert.equal(new URL(scholarly.find(url=>url.includes('openalex'))).searchParams.get('search'),'submitted & current');
  assert.equal(new URL(scholarly.find(url=>url.includes('crossref'))).searchParams.get('query'),'submitted & current');
  assert.ok(scholarly.every(url=>!url.includes('prefilled')));
});
