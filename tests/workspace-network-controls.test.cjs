// Regression checks for the actual Connections Map controls in workspace.html.
// Run from repository root: node --test tests/workspace-network-controls.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'workspace.html'), 'utf8');
const start = html.indexOf('function adjustNetworkView(mode){');
const end = html.indexOf('function solutionsScreen(){', start);
assert.ok(start >= 0 && end > start, 'Connections Map view helper exists');

function app() {
  let viewBox = '0 0 1100 665';
  const svg = {
    getAttribute(name) { assert.equal(name, 'viewBox'); return viewBox; },
    setAttribute(name, value) { assert.equal(name, 'viewBox'); viewBox = value; }
  };
  const adjust = vm.runInNewContext(
    html.slice(start, end) + ';adjustNetworkView',
    { $: id => id === 'connectionsSvg' ? svg : null }
  );
  return { adjust, read: () => viewBox.split(' ').map(Number) };
}

test('seven accessible controls are wired to the map rather than the case nodes', () => {
  assert.match(html, /<svg id="connectionsSvg" class="network-svg"/);
  for (const mode of ['in', 'out', 'left', 'right', 'up', 'down', 'fit']) {
    assert.ok(html.includes('data-action="network-view" data-view="' + mode + '" aria-controls="connectionsSvg"'), mode);
  }
  assert.match(html, /class="network-tools" role="group" aria-label="Connections map navigation"/);
  assert.match(html, /\.network-tools button\{min-height:44px/);
  assert.match(html, /case 'network-view':adjustNetworkView\(b\.dataset\.view\);break;/);
  assert.match(html, /data-action="graph-node"/);
});

test('zoom preserves the map centre and its aspect ratio', () => {
  const { adjust, read } = app();
  adjust('in');
  const [x, y, w, h] = read();
  assert.equal(w, 880);
  assert.equal(h, 532);
  assert.equal(x, 110);
  assert.equal(y, 66.5);
  adjust('out');
  assert.deepEqual(read(), [0, 0, 1100, 665]);
});

test('pan controls move in the requested directions', () => {
  const { adjust, read } = app();
  adjust('left'); assert.ok(read()[0] < 0);
  adjust('fit');
  adjust('right'); assert.ok(read()[0] > 0);
  adjust('fit');
  adjust('up'); assert.ok(read()[1] < 0);
  adjust('fit');
  adjust('down'); assert.ok(read()[1] > 0);
});

test('zoom remains bounded and fit restores the original map', () => {
  const { adjust, read } = app();
  for (let i = 0; i < 50; i++) adjust('in');
  assert.equal(read()[2], 350);
  for (let i = 0; i < 50; i++) adjust('out');
  assert.equal(read()[2], 1760);
  adjust('fit');
  assert.deepEqual(read(), [0, 0, 1100, 665]);
});

test('unknown controls do not change view and missing SVG is safe', () => {
  const { adjust, read } = app();
  adjust('__proto__');
  assert.deepEqual(read(), [0, 0, 1100, 665]);
  const missing = vm.runInNewContext(html.slice(start, end) + ';adjustNetworkView', { $: () => null });
  assert.doesNotThrow(() => missing('left'));
});

test('workspace inline JavaScript still parses', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [i, match] of scripts.entries()) {
    if (match[1].trim()) new vm.Script(match[1], { filename: 'workspace-script-' + i });
  }
});
