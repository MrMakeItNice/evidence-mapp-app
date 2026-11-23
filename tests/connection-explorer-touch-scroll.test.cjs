// Regression: the Classic Connection Explorer must not trap vertical touch scrolling.
// Run from the repo root: node --test tests/connection-explorer-touch-scroll.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'connection-explorer.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test('coarse-pointer map allows native vertical page scroll', () => {
  assert.ok(css, 'page stylesheet should exist');
  const defaultIndex = css.indexOf('touch-action:none');
  const overrideIndex = css.indexOf('@media (any-pointer:coarse){.graph{touch-action:pan-y}');
  assert.ok(defaultIndex >= 0 && overrideIndex > defaultIndex, 'touch override must follow default map rule');
  assert.match(css.slice(overrideIndex), /\.graph-tools button,[^{]*\{min-width:44px;min-height:44px\}/);
});

test('touch gestures have accurate on-screen instructions', () => {
  assert.match(html, /On touchscreens, swipe sideways to pan and vertically to scroll the page/);
});

test('native scrolling cancels active graph pan without blocking it', () => {
  assert.ok(script, 'page script should exist');
  assert.match(script, /graph\.addEventListener\('pointercancel',endPan\)/);
  assert.doesNotMatch(script, /graph\.addEventListener\('pointermove',[^;]*preventDefault\(/);
});

test('Connection Explorer inline JavaScript remains valid', () => {
  assert.doesNotThrow(() => new Function(script));
});

test('interactive case and source nodes are exposed as a labeled group, not a flattened image', () => {
  assert.match(html, /<span class="muted" id="graph-help">Explore the public citation network/);
  assert.match(html, /<svg id="graph" class="graph" role="group" aria-label="Interactive case and source connection diagram" aria-describedby="graph-help"/);
  assert.doesNotMatch(html, /<svg id="graph"[^>]*role="img"/);
  assert.match(script, /class:'node',tabindex:0,role:'button'/);
  assert.match(script, /e\.key==='Enter'\|\|e\.key===' '/);
});


test('initial Case File selection preserves incoming section anchors', () => {
  const vm = require('node:vm');
  const begin = script.indexOf("const hash=new URLSearchParams(location.hash.slice(1)).get('case');");
  const end = script.indexOf("else $('status').textContent", begin);
  assert.ok(begin >= 0 && end > begin, 'initial selection branch should be present');
  const init = script.slice(begin, end);
  const record = { id: 7, title: 'Test published case' };
  const byId = new Map([['7', record]]);
  for (const [hash, shouldUpdate] of [
    ['#contribute', false],
    ['#case=7', true],
    ['', true],
    ['#other-section', false]
  ]) {
    const calls = [];
    vm.runInNewContext(init, {
      URLSearchParams, location: { hash }, byId, cases: [record],
      focus: (id, updateHash) => calls.push({ id, updateHash })
    });
    assert.equal(calls.length, 1, 'a default or requested case should still be displayed');
    assert.equal(calls[0].id, 7);
    assert.equal(calls[0].updateHash, shouldUpdate, hash || 'no fragment');
  }
});

test('later explicit Case File selections still update the address fragment', () => {
  const vm = require('node:vm');
  const definition = script.match(/function focus\(id,updateHash=true\)\{[\s\S]*?\}(?=function render\()/);
  assert.ok(definition, 'case selection must accept a hash-update flag');
  const writes = [];
  vm.runInNewContext(
    'let selected=null;' + definition[0] + 'focus(7,false);focus(7);',
    {
      resetView() {}, byId: new Map([['7', { id: 7, title: 'Test published case' }]]),
      history: { replaceState(_state, _title, hash) { writes.push(hash); } },
      detail() {}, render() {}, encodeURIComponent
    }
  );
  assert.deepEqual(writes, ['#case=7'], 'only user-driven selection updates #case');
});

test('both case and source nodes receive an obvious keyboard-focus outline', () => {
  assert.ok(css && script);
  // Each rendered card type shares the first child SVG rectangle; source cards
  // have no SVG circle, so styling only .node:focus circle is insufficient.
  assert.match(script, /const group=svg\('g',\{class:'node',tabindex:0,role:'button'/);
  assert.match(script, /svg\('rect',\{x,y,width:w,height:h,rx:6/);
  assert.match(css, /\.node:focus-visible>rect:first-of-type\{stroke:#fff;stroke-width:3\}/);
  assert.doesNotMatch(css, /\.node:focus circle\{/);
  assert.match(html, /Tab to a case or source card and press Enter or Space to inspect/);
});


test('only the initiating primary pointer can move or finish a graph pan', () => {
  const vm = require('node:vm');
  const start = script.indexOf("let pan=null;const graph=$('graph');");
  const end = script.indexOf("graph.addEventListener('wheel'", start);
  assert.ok(start >= 0 && end > start, 'graph pan implementation must be present');

  const listeners = new Map(), captures = [];
  const graph = {
    addEventListener(name, fn) { listeners.set(name, fn); },
    setPointerCapture(id) { captures.push(id); },
    getBoundingClientRect() { return { width: 760, height: 520 }; }
  };
  const view = { x: 0, y: 0, w: 760, h: 520 };
  let redraws = 0;
  vm.runInNewContext(script.slice(start, end), {
    $: () => graph, view, applyView() { redraws++; }
  });
  const target = { closest() { return null; } };
  const fire = (name, id, x = 10, y = 10, extras = {}) => {
    const fn = listeners.get(name);
    assert.ok(fn, name + ' handler must exist');
    fn({ pointerId: id, clientX: x, clientY: y, isPrimary: true, button: 0, target, ...extras });
  };

  fire('pointerdown', 1);
  fire('pointerdown', 2, 50, 50, { isPrimary: false });
  assert.deepEqual(captures, [1], 'a second touch cannot take capture');
  fire('pointermove', 2, 200, 10);
  assert.equal(view.x, 0, 'a second pointer cannot pan the first pointer');
  fire('pointermove', 1, 86, 10);
  assert.equal(view.x, -76);
  fire('pointerup', 2);
  fire('pointermove', 1, 162, 10);
  assert.equal(view.x, -152, 'another pointer releasing does not cancel the active pan');
  fire('pointercancel', 1);
  fire('pointermove', 1, 200, 10);
  assert.equal(view.x, -152, 'cancel clears only its owning pan');

  fire('pointerdown', 3, 10, 10, { button: 2 });
  fire('pointerdown', 4, 10, 10, { isPrimary: false });
  assert.deepEqual(captures, [1], 'right click and nonprimary touch do not initiate a pan');
  fire('pointerdown', 5);
  fire('lostpointercapture', 5);
  fire('pointermove', 5, 100, 10);
  assert.equal(view.x, -152, 'lost capture ends a pan without moving the view');
  assert.deepEqual(captures, [1, 5]);
  assert.equal(redraws, 2, 'only intentional moves redraw the graph');
});

test('case search reports displayed/total matches, limits, no matches, and selected case', () => {
  const vm = require('node:vm');
  const begin = script.indexOf('function search(){');
  const end = script.indexOf("\n$('search').addEventListener('input',search);", begin);
  assert.ok(begin >= 0 && end > begin, 'case search function must be available');
  assert.match(html, /id="search"[^>]*aria-describedby="case-search-status"/);
  assert.match(html, /id="case-search-status" role="status" aria-atomic="true"/);
  assert.match(script, /byUrl\.get\(k\)\.push\(r\)\}\);search\(\)/, 'loaded cases refresh pretyped search');
  assert.match(script, /Case search unavailable because the public investigation data could not be loaded/);
  const input = { value: 'Blue' }, results = { children: [] }, status = { textContent: '' };
  const elements = { search: input, results, 'case-search-status': status };
  const selected = [];
  const ctx = {
    $: id => elements[id],
    cases: Array.from({ length: 18 }, (_, i) => ({ id: i + 1, title: 'Blue Case ' + i })),
    clear: el => { el.children = []; },
    el: (tag, text, parent) => {
      const element = { tag, textContent: text, handlers: {},
        addEventListener(event, callback) { this.handlers[event] = callback; } };
      parent.children.push(element);
      return element;
    },
    focus: id => selected.push(id)
  };
  vm.runInNewContext(script.slice(begin,end) + '\nsearch();', ctx);
  assert.equal(results.children.length, 15);
  assert.match(status.textContent, /15 of 18 matching published cases shown.*Refine your search/);
  results.children[0].handlers.click();
  assert.deepEqual(selected, [1]);
  assert.equal(results.children.length, 0, 'selection closes the search list');
  assert.match(status.textContent, /Selected Blue Case 0/);
  input.value = 'unfindable';
  vm.runInNewContext('search()', ctx);
  assert.match(status.textContent, /No matching published cases/);
  input.value = '';
  vm.runInNewContext('search()', ctx);
  assert.equal(status.textContent, 'Search 18 published case titles.');
});

test('coarse-pointer Explorer links and case/source controls meet 44px touch targets', () => {
  assert.ok(css, 'page stylesheet should exist');
  const coarse = css.slice(css.indexOf('@media (any-pointer:coarse){'));
  assert.match(coarse, /\.graph-tools button,\.results button,\.detail button,#contribute button\{min-width:44px;min-height:44px\}/,
    'graph controls, searchable case buttons, source-related case buttons, and private-draft buttons share minimum targets');
  assert.match(coarse, /\.results button\{font-size:14px\}/, 'search results should not stay at 12px on touch screens');
  assert.match(coarse, /header nav a\{display:inline-flex;align-items:center;min-height:44px;padding:0 8px\}/,
    'header navigation links need a touch-height and side padding');
  assert.match(coarse, /\.graph\{touch-action:pan-y\}/, 'touch-target improvement must preserve native page scroll');
});
