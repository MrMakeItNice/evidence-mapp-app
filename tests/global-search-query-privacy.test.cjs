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
    setAttribute(name, value) { (this.attributes ||= {})[name] = value; },
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


test('scholarly previews show parsed link hosts and keep unsafe destinations non-clickable', async () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = new Map();
  const element = tag => ({
    tag, children: [], value: '', textContent: '', href: '', handlers: {},
    append(...children) { this.children.push(...children) },
    replaceChildren(...children) { this.children = children },
    setAttribute(name, value) { (this.attributes ||= {})[name] = value; },
    addEventListener(type, handler) { this.handlers[type] = handler }
  });
  const get = id => { if (!nodes.has(id)) nodes.set(id, element('div')); return nodes.get(id) };
  const fetch = async url => {
    const address = String(url);
    if (address.includes('/api/cases')) return { ok: true, json: async () => [] };
    if (address.includes('api.openalex.org')) return { ok: true, json: async () => ({ results: [
      { display_name: 'Safe DOI', doi: 'https://doi.org/10.1234/atlas-test', id: 'https://openalex.org/W1' },
      { display_name: 'Deceptive URL', doi: 'https://records.gov@attacker.example/record', id: 'https://openalex.org/W2' },
      { display_name: 'Unsafe scheme', doi: 'javascript:alert(1)', id: 'https://openalex.org/W3' },
      { display_name: 'Missing URL' }
    ] }) };
    return { ok: true, json: async () => ({ message: { items: [{title: ['Publisher record'], DOI: '10.1234/crossref-test', URL: 'https://journals.example.org/report?article=42#page=3'}] } }) };
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
  assert.equal(rows.find(row => row.children[1] === safe).children[3].textContent, 'Link host: doi.org');
  const publisher = findHeading('Publisher record');
  assert.equal(publisher.children[0].href, 'https://journals.example.org/report?article=42#page=3');
  const publisherRow = rows.find(row => row.children[1] === publisher);
  assert.match(publisherRow.children[0].textContent, /^Crossref/);
  assert.equal(publisherRow.children[3].textContent, 'Link host: journals.example.org');
  for (const title of ['Deceptive URL', 'Unsafe scheme', 'Missing URL']) {
    const heading = findHeading(title);
    assert.ok(heading, title + ' remains visible as unverified scholarly metadata');
    assert.equal(heading.children.length, 0, title + ' must not have a clickable link');
    assert.equal(rows.find(row => row.children[1] === heading).children[3].textContent, 'No valid web link recorded');
  }
});

function delayedArchivePage(options = {}) {
  const nodes = new Map(), calls = [];
  const element = () => ({children: [], value: '', textContent: '', handlers: {},
    focus() { document.activeElement = this; },
    append(...children) { this.children.push(...children) },
    replaceChildren(...children) { this.children = children },
    setAttribute(name, value) { (this.attributes ||= {})[name] = value; },
    addEventListener(type, handler) { this.handlers[type] = handler }});
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id) };
  let resolveArchive;
  const archive = new Promise(resolve => { resolveArchive = resolve });
  const fetch = options.fetch || (async url => {
    calls.push(String(url));
    if (String(url).includes('/api/cases')) return archive;
    return {ok: true, json: async () => String(url).includes('openalex') ? {results: []} : {message: {items: []}}};
  });
  const document = {getElementById: get, createElement: element};
  new Function('document','location','history','fetch','URL','URLSearchParams','AbortController','setTimeout','clearTimeout',
    html.match(/<script>([\s\S]*?)<\/script>/)[1])(
    document,
    {search: '?q=Original', href: 'https://atlas.example/global-search.html?q=Original'},
    {replaceState() {}}, fetch, URL, URLSearchParams, AbortController, options.setTimeout || (() => 1), options.clearTimeout || (() => {}));
  const submit = term => { get('q').value = term; get('search').handlers.submit({preventDefault() {}}) };
  const complete = async (ok = true) => {
    resolveArchive({ok, json: async () => [
      {id: 1, title: 'Original investigation'}, {id: 2, title: 'Latest investigation'}, {id: 3, title: 'Unsent investigation'}
    ]});
    await new Promise(resolve => setImmediate(resolve));
  };
  const text = node => node.textContent + node.children.map(text).join(' ');
  return {get, calls, submit, complete, document, resultText: () => text(get('results'))};
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

for (const phase of ['headers', 'body']) test('archive deadline covers stalled ' + phase, async () => {
  let fire, signal, cleared = 0;
  const page = delayedArchivePage({
    setTimeout(fn, ms) { assert.equal(ms, 12000); fire = fn; return 77 },
    clearTimeout(id) { assert.equal(id, 77); cleared++ },
    fetch: async (_url, options) => {
      signal = options.signal;
      const stalled = () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), {once: true}));
      if (phase === 'headers') return stalled();
      return {ok: true, json: stalled};
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cleared, 0, 'deadline remains active until the entire response is read');
  fire();await new Promise(resolve => setImmediate(resolve));
  assert.equal(signal.aborted, true);assert.equal(cleared, 1);
  assert.match(page.get('archive-status').textContent, /timed out/);
  assert.match(page.resultText(), /Try the public case library or Paper Trails/);
  page.submit('');
  assert.match(page.get('archive-status').textContent, /unavailable/);
  assert.doesNotMatch(page.get('archive-status').textContent, /Loading/);
});

test('archive deadline clears on success, HTTP, network, JSON and response-shape errors', async () => {
  for (const mode of ['success', 'http', 'network', 'json', 'shape']) {
    let cleared = 0, signal;
    const page = delayedArchivePage({
      setTimeout(_fn, ms) { assert.equal(ms, 12000); return 88 },
      clearTimeout(id) { assert.equal(id, 88); cleared++ },
      fetch: async (_url, options) => {
        signal = options.signal;
        if (mode === 'network') throw Error('Network failure');
        return {ok: mode !== 'http', json: async () => {
          if (mode === 'json') throw Error('Invalid JSON');
          return mode === 'shape' ? {} : [];
        }};
      }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(cleared, 1, mode + ' cleans up its timer');
    assert.equal(signal.aborted, mode !== 'success');
    assert.doesNotMatch(page.get('archive-status').textContent, /timed out/);
    if (mode === 'success') assert.match(page.get('archive-status').textContent, /matching cases/);
    else assert.match(page.get('archive-status').textContent, /could not be loaded/);
  }
});


test('scholarly coverage distinguishes outage, partial response and truly empty results', async () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const mode of ['none', 'partial-empty', 'partial-record', 'all-empty']) {
    const nodes = new Map();
    const element = tag => ({
      tag, children: [], textContent: '', value: '', href: '', handlers: {},
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      setAttribute(name, value) { (this.attributes ||= {})[name] = value; },
      addEventListener(type, handler) { this.handlers[type] = handler; }
    });
    const get = id => {
      if (!nodes.has(id)) nodes.set(id, element('div'));
      return nodes.get(id);
    };
    const fetch = async url => {
      const address = String(url);
      if (address.includes('/api/cases')) return { ok: true, json: async () => [] };
      if (address.includes('openalex') && mode !== 'all-empty') throw Error('index unavailable');
      if (address.includes('crossref') && mode === 'none') throw Error('index unavailable');
      return {
        ok: true,
        json: async () => address.includes('openalex') ? { results: [] } : { message: { items:
          mode === 'partial-record'
            ? [{ title: ['Test source'], URL: 'https://doi.org/10.1234/atlas-test', DOI: '10.1234/atlas-test' }]
            : [] } }
      };
    };
    new Function('document', 'location', 'history', 'fetch', 'URL', 'URLSearchParams',
      'AbortController', 'setTimeout', 'clearTimeout', script)(
      { getElementById: get, createElement: element },
      { search: '', href: 'https://atlas.example/global-search.html' },
      { replaceState() {} }, fetch, URL, URLSearchParams, AbortController, () => 1, () => {});
    get('q').value = 'source provenance';
    get('search').handlers.submit({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    const statusText = get('live-status').textContent;
    const output = get('live-results').children;
    if (mode === 'none') {
      assert.match(statusText, /scholarly APIs unavailable/);
      assert.match(output[0].textContent, /No scholarly indexes responded/);
      assert.doesNotMatch(output[0].textContent, /No records returned/);
    } else if (mode === 'partial-empty') {
      assert.match(statusText, /0 scholarly records returned from 1 of 2 indexes · partial coverage/);
      assert.match(output[0].textContent, /No records returned by the responding scholarly indexes/);
    } else if (mode === 'partial-record') {
      assert.match(statusText, /1 scholarly record returned from 1 of 2 indexes · partial coverage/);
      assert.equal(output[0].children[1].children[0].href, 'https://doi.org/10.1234/atlas-test');
    } else {
      assert.match(statusText, /0 scholarly records returned from 2 of 2 indexes/);
      assert.doesNotMatch(statusText, /partial coverage/);
      assert.match(output[0].textContent, /No records returned by the responding scholarly indexes/);
    }
  }
});


test('oversized scholarly searches preserve complete Unicode terms and cannot transmit a partial query', async () => {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = new Map(), calls = [];
  let currentUrl = 'https://atlas.example/global-search.html';
  const element = () => ({
    value: '', textContent: '', children: [], handlers: {}, validationMessage: '', reports: 0, focused: false,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { (this.attributes ||= {})[name] = value; },
    addEventListener(type, handler) { this.handlers[type] = handler; },
    setCustomValidity(message) { this.validationMessage = message; },
    reportValidity() { this.reports++; return !this.validationMessage; },
    focus() { this.focused = true; }
  });
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  const fetch = async url => {
    const address = String(url);
    calls.push(address);
    return { ok: true, json: async () => address.includes('/api/cases') ? []
      : address.includes('openalex') ? { results: [] } : { message: { items: [] } } };
  };
  new Function('document','location','history','fetch','URL','URLSearchParams','AbortController','setTimeout','clearTimeout',script)(
    { getElementById: get, createElement: element },
    { search: '', href: currentUrl },
    { replaceState(_state, _title, url) { currentUrl = String(url); } },
    fetch, URL, URLSearchParams, AbortController, () => 1, () => {});
  await new Promise(resolve => setImmediate(resolve));
  const submit = value => {
    get('q').value = value;
    get('search').handlers.submit({ preventDefault() {} });
  };
  submit('previous');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.filter(x => /api\.(openalex|crossref)\.org/.test(x)).length, 2);
  const oversized = '🔎'.repeat(301);
  submit(oversized);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(get('q').value, oversized, 'the original search stays intact');
  assert.match(get('q').validationMessage, /300 characters or fewer/);
  assert.equal(get('q').reports, 1);
  assert.equal(get('q').focused, true);
  assert.match(get('archive-status').textContent, /Search not submitted/);
  assert.equal(get('live-results').children.length, 0, 'old scholarly previews are cleared');
  assert.match(get('live-status').textContent, /Enter a search/);
  assert.equal(calls.filter(x => /api\.(openalex|crossref)\.org/.test(x)).length, 2,
    'no partial search reaches external providers');
  assert.equal(new URL(currentUrl).searchParams.has('q'), false, 'stale query links are removed');
  get('q').handlers.input();
  assert.equal(get('q').validationMessage, '');
  submit('📜'.repeat(300));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(new URL(currentUrl).searchParams.get('q'), '📜'.repeat(300));
  assert.equal(calls.filter(x => /api\.(openalex|crossref)\.org/.test(x)).length, 4);
});

function retryableArchivePage() {
  let attempts = 0, resolveRetry;
  const requests = [];
  const page = delayedArchivePage({fetch: async url => {
    requests.push(String(url));
    if (String(url).includes('/api/cases')) {
      attempts++;
      if (attempts === 1) return {ok: false};
      return new Promise(resolve => { resolveRetry = resolve });
    }
    return {ok: true, json: async () => String(url).includes('openalex') ? {results: []} : {message: {items: []}}};
  }});
  return {...page, requests, attempts: () => attempts,
    async finish(ok = true, records = [{id: 2, title: 'Latest investigation'}]) {
      resolveRetry({ok, json: async () => records});
      await new Promise(resolve => setImmediate(resolve));
    }};
}

test('archive retry preserves submitted and unsent terms without resending scholarly queries', async () => {
  assert.match(html, /id="retry-archive"[^>]*type="button"[^>]*aria-controls="results"[^>]*aria-describedby="archive-status"/);
  const page = retryableArchivePage();
  await new Promise(resolve => setImmediate(resolve));
  const retry = page.get('retry-archive');
  assert.equal(retry.hidden, false);
  page.submit('Latest');page.get('q').value = 'Unsent';
  await new Promise(resolve => setImmediate(resolve));
  const externalCount = page.requests.filter(url => !url.includes('/api/cases')).length;
  page.document.activeElement = retry;
  retry.handlers.click();retry.handlers.click();
  assert.equal(page.attempts(), 2, 'duplicate activation cannot start a third load');
  assert.equal(retry.attributes['aria-disabled'], 'true');
  assert.match(page.get('archive-status').textContent, /Loading/);
  await page.finish();
  assert.match(page.resultText(), /Latest investigation/);
  assert.equal(page.get('q').value, 'Unsent');
  assert.equal(page.requests.filter(url => !url.includes('/api/cases')).length, externalCount);
  assert.equal(page.document.activeElement, page.get('archive-status'));
  assert.equal(retry.hidden, true);assert.equal(retry.attributes['aria-disabled'], 'false');
});

test('retry recovery does not steal focus after the reader returns to typing', async () => {
  const page = retryableArchivePage();
  await new Promise(resolve => setImmediate(resolve));
  page.get('retry-archive').handlers.click();
  page.get('q').value = 'Still editing';page.get('q').focus();
  await page.finish(true, []);
  assert.equal(page.document.activeElement, page.get('q'));
  assert.equal(page.get('q').value, 'Still editing');
  assert.equal(page.get('retry-archive').hidden, true);
  assert.match(page.get('archive-status').textContent, /0 matching cases/);
});

test('failed retries remain available and permit another attempt', async () => {
  const page = retryableArchivePage();
  await new Promise(resolve => setImmediate(resolve));
  const retry = page.get('retry-archive');
  retry.handlers.click();await page.finish(false);
  assert.equal(retry.hidden, false);assert.equal(retry.attributes['aria-disabled'], 'false');
  assert.match(page.get('archive-status').textContent, /could not be loaded/);
  retry.handlers.click();assert.equal(page.attempts(), 3);
  await page.finish();assert.equal(retry.hidden, true);
  assert.equal(page.requests.filter(url => !url.includes('/api/cases')).length, 0);
});

function pendingScholarlyPage(phase, ignoreAbort = false) {
  const requests = [], timers = new Map(), cleared = new Set();let timerId = 0;
  const page = delayedArchivePage({
    setTimeout(fn, ms) { const id = ++timerId;timers.set(id, {fn, ms});return id },
    clearTimeout(id) { cleared.add(id) },
    fetch: async (url, {signal}) => {
      if (String(url).includes('/api/cases')) return {ok: true, json: async () => []};
      const query = new URL(url).searchParams;
      const term = query.get('search') || query.get('query');
      let finish, reject;
      const pending = new Promise((resolve, fail) => { finish = resolve;reject = fail });
      if (!ignoreAbort) signal.addEventListener('abort', () => reject(Error('aborted')), {once: true});
      requests.push({signal, term, finish() { finish(String(url).includes('openalex') ? {
        results: [{display_name: 'Result for ' + term, doi: 'https://doi.org/10.1234/' + encodeURIComponent(term)}]
      } : {message: {items: []}}) }});
      if (phase === 'headers') return pending.then(data => ({ok: true, json: async () => data}));
      return {ok: true, json: () => pending};
    }
  });
  const text = node => node.textContent + node.children.map(text).join(' ');
  return {...page, requests, timers, cleared, liveText: () => text(page.get('live-results'))};
}

for (const phase of ['headers', 'body']) test('replacement cancels both scholarly ' + phase + ' requests and cleans their timer', async () => {
  const page = pendingScholarlyPage(phase);
  await new Promise(resolve => setImmediate(resolve));
  page.submit('old');await new Promise(resolve => setImmediate(resolve));
  page.submit('latest');await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.requests.length, 4);
  assert.ok(page.requests.slice(0, 2).every(request => request.signal.aborted));
  assert.ok(page.requests.slice(2).every(request => !request.signal.aborted));
  const scholarlyTimers = [...page.timers].filter(([, timer]) => timer.ms === 11000).map(([id]) => id);
  assert.equal(page.cleared.has(scholarlyTimers[0]), true);
  assert.equal(page.cleared.has(scholarlyTimers[1]), false);
  assert.match(page.get('live-status').textContent, /Searching/);
  page.requests.slice(2).forEach(request => request.finish());
  await new Promise(resolve => setImmediate(resolve));
  assert.match(page.liveText(), /Result for latest/);assert.doesNotMatch(page.liveText(), /Result for old/);
  assert.equal(page.cleared.has(scholarlyTimers[1]), true);
  page.submit('');
  assert.ok(page.requests.slice(2).every(request => !request.signal.aborted), 'completed controllers are released');
});

test('a late stale completion cannot lose the current cancellation handle or repaint cleared results', async () => {
  const page = pendingScholarlyPage('headers', true);
  await new Promise(resolve => setImmediate(resolve));
  page.submit('old');page.submit('latest');
  assert.ok(page.requests.slice(0, 2).every(request => request.signal.aborted));
  page.requests.slice(0, 2).forEach(request => request.finish());
  await new Promise(resolve => setImmediate(resolve));
  assert.match(page.get('live-status').textContent, /Searching/);assert.equal(page.liveText(), '');
  page.submit('');
  assert.ok(page.requests.slice(2).every(request => request.signal.aborted), 'clearing still aborts the current pair');
  page.requests.slice(2).forEach(request => request.finish());
  await new Promise(resolve => setImmediate(resolve));
  assert.match(page.get('live-status').textContent, /Enter a search/);assert.equal(page.liveText(), '');
  assert.ok([...page.timers.keys()].every(id => page.cleared.has(id)), 'all archive and scholarly timers are released');
});

async function scholarlyResponsePage(openalex, crossref) {
  const page = delayedArchivePage({fetch: async url => ({ok: true, json: async () =>
    String(url).includes('/api/cases') ? [] : String(url).includes('openalex') ? openalex : crossref
  })});
  page.submit('oversight');
  await new Promise(resolve => setImmediate(resolve));
  const text = node => node.textContent + node.children.map(text).join(' ');
  return {status: page.get('live-status').textContent, results: text(page.get('live-results'))};
}

for (const provider of ['OpenAlex', 'Crossref']) test(provider + ' malformed envelopes do not count as a responding search index', async () => {
  // HTTP 200 is insufficient: errors, absent/null fields and non-array payloads
  // must not be described as a completed search with zero matches.
  const malformed = provider === 'OpenAlex'
    ? [null, {}, {error: 'rate limited'}, {results: null}, {results: {}}, {results: 'empty'}]
    : [null, {}, {message: null}, {message: {}}, {message: {items: null}}, {message: {items: {}}}];
  for (const payload of malformed) {
    const page = await scholarlyResponsePage(
      provider === 'OpenAlex' ? payload : {results: []},
      provider === 'Crossref' ? payload : {message: {items: []}}
    );
    assert.match(page.status, /0 scholarly records returned from 1 of 2 indexes · partial coverage/);
    assert.match(page.results, /No records returned by the responding scholarly indexes/);
    assert.doesNotMatch(page.status, /from 2 of 2 indexes/);
  }
});

test('two malformed scholarly envelopes show unavailability rather than zero search matches', async () => {
  const page = await scholarlyResponsePage({}, {message: {}});
  assert.match(page.status, /Live scholarly APIs unavailable/);
  assert.match(page.results, /No scholarly indexes responded/);
  assert.doesNotMatch(page.results, /No records returned/);
});

test('a malformed scholarly response does not suppress valid records from the other provider', async () => {
  for (const provider of ['OpenAlex', 'Crossref']) {
    const page = await scholarlyResponsePage(
      provider === 'OpenAlex' ? {results: [{display_name: 'Valid OpenAlex record', id: 'https://openalex.org/W1'}]} : {},
      provider === 'Crossref' ? {message: {items: [{title: ['Valid Crossref record'], URL: 'https://doi.org/10.1234/test'}]}} : {}
    );
    assert.match(page.status, /1 scholarly record returned from 1 of 2 indexes · partial coverage/);
    assert.match(page.results, new RegExp('Valid ' + provider + ' record'));
  }
});

test('genuine empty scholarly result arrays remain successful zero-match searches', async () => {
  const page = await scholarlyResponsePage({results: []}, {message: {items: []}});
  assert.match(page.status, /0 scholarly records returned from 2 of 2 indexes/);
  assert.doesNotMatch(page.status, /partial coverage|unavailable/);
  assert.match(page.results, /No records returned by the responding scholarly indexes/);
});
