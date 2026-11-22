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


test('scholarly previews do not make credential-bearing or non-web source URLs clickable', async () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = new Map();
  const element = tag => ({
    tag, children: [], value: '', textContent: '', href: '', handlers: {},
    append(...children) { this.children.push(...children) },
    replaceChildren(...children) { this.children = children },
    addEventListener(type, handler) { this.handlers[type] = handler }
  });
  const get = id => { if (!nodes.has(id)) nodes.set(id, element('div')); return nodes.get(id) };
  const fetch = async url => {
    const address = String(url);
    if (address.includes('/api/cases')) return { ok: true, json: async () => [] };
    if (address.includes('api.openalex.org')) return { ok: true, json: async () => ({ results: [
      { display_name: 'Safe DOI', doi: 'https://doi.org/10.1234/atlas-test', id: 'https://openalex.org/W1' },
      { display_name: 'Deceptive URL', doi: 'https://records.gov@attacker.example/record', id: 'https://openalex.org/W2' },
      { display_name: 'Unsafe scheme', doi: 'javascript:alert(1)', id: 'https://openalex.org/W3' }
    ] }) };
    return { ok: true, json: async () => ({ message: { items: [] } }) };
  };
  new Function('document', 'location', 'history', 'fetch', 'URL', 'URLSearchParams',
    'AbortController', 'setTimeout', 'clearTimeout', script)(
    { getElementById: get, createElement: element },
    { search: '', href: 'https://atlas.example/global-search.html' },
    { replaceState() {} }, fetch, URL, URLSearchParams, AbortController, () => 1, () => {});
  await new Promise(resolve => setImmediate(resolve));
  get('q').value = 'declassified files';
  get('search').handlers.submit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  const rows = get('live-results').children;
  const findHeading = name => rows.find(row => row.children[1]?.textContent === name ||
    row.children[1]?.children[0]?.textContent?.startsWith(name))?.children[1];
  const safe = findHeading('Safe DOI');
  assert.ok(safe?.children[0], 'safe DOI should have a clickable preview');
  assert.equal(safe.children[0].href, 'https://doi.org/10.1234/atlas-test');
  for (const title of ['Deceptive URL', 'Unsafe scheme']) {
    const heading = findHeading(title);
    assert.ok(heading, title + ' remains visible as unverified scholarly metadata');
    assert.equal(heading.children.length, 0, title + ' must not have a clickable link');
  }
});

function delayedArchivePage() {
  const nodes = new Map(), calls = [];
  const element = () => ({children: [], value: '', textContent: '', handlers: {},
    append(...children) { this.children.push(...children) },
    replaceChildren(...children) { this.children = children },
    addEventListener(type, handler) { this.handlers[type] = handler }});
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id) };
  let resolveArchive;
  const archive = new Promise(resolve => { resolveArchive = resolve });
  const fetch = async url => {
    calls.push(String(url));
    if (String(url).includes('/api/cases')) return archive;
    return {ok: true, json: async () => String(url).includes('openalex') ? {results: []} : {message: {items: []}}};
  };
  new Function('document','location','history','fetch','URL','URLSearchParams','AbortController','setTimeout','clearTimeout',
    html.match(/<script>([\s\S]*?)<\/script>/)[1])(
    {getElementById: get, createElement: element},
    {search: '?q=Original', href: 'https://atlas.example/global-search.html?q=Original'},
    {replaceState() {}}, fetch, URL, URLSearchParams, AbortController, () => 1, () => {});
  const submit = term => { get('q').value = term; get('search').handlers.submit({preventDefault() {}}) };
  const complete = async (ok = true) => {
    resolveArchive({ok, json: async () => [
      {id: 1, title: 'Original investigation'}, {id: 2, title: 'Latest investigation'}, {id: 3, title: 'Unsent investigation'}
    ]});
    await new Promise(resolve => setImmediate(resolve));
  };
  const text = node => node.textContent + node.children.map(text).join(' ');
  return {get, calls, submit, complete, resultText: () => text(get('results'))};
}

test('late archive results use the latest submission and preserve unsent input', async () => {
  const page = delayedArchivePage();
  page.submit('Original');page.submit('Latest');
  assert.match(page.get('archive-status').textContent, /Loading/);
  assert.doesNotMatch(page.get('archive-status').textContent, /unavailable/i);
  page.get('q').value = 'Unsent';
  await page.complete();
  assert.match(page.resultText(), /Latest investigation/);
  assert.doesNotMatch(page.resultText(), /Original investigation|Unsent investigation/);
  assert.equal(page.get('q').value, 'Unsent');
  assert.match(page.get('archive-status').textContent, /1 matching cases/);
});

test('unsent edits do not replace the prefilled archive query or contact providers', async () => {
  const page = delayedArchivePage();
  page.get('q').value = 'Unsent';
  await page.complete();
  assert.match(page.resultText(), /Original investigation/);
  assert.doesNotMatch(page.resultText(), /Unsent investigation/);
  assert.equal(page.get('q').value, 'Unsent');
  assert.equal(page.calls.length, 1);
});

test('clearing a pending search stays empty after load and failures remain unavailable', async () => {
  const cleared = delayedArchivePage();
  cleared.submit('Latest');cleared.submit('');await cleared.complete();
  assert.equal(cleared.resultText(), '');
  assert.match(cleared.get('archive-status').textContent, /3 published cases loaded/);
  const failed = delayedArchivePage();
  await failed.complete(false);failed.submit('Latest');
  assert.match(failed.get('archive-status').textContent, /unavailable/i);
  assert.doesNotMatch(failed.get('archive-status').textContent, /Loading/);
});
