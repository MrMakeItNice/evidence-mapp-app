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
  assert.match(css.slice(overrideIndex), /\.graph-tools button\{min-width:44px;min-height:44px\}/);
});

test('touch gestures have accurate on-screen instructions', () => {
  assert.match(html, /On touchscreens, swipe sideways to pan and vertically to scroll the page/);
});

test('native scrolling cancels active graph pan without blocking it', () => {
  assert.ok(script, 'page script should exist');
  assert.match(script, /graph\.addEventListener\('pointercancel',\(\)=>pan=null\)/);
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
