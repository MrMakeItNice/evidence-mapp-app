// Run: node --test tests/globe-default-zoom-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const defaultZoom = 'Math.max(window.innerWidth>=768?7.1:8.5,5.8/Math.max(.45,camera.aspect))';

test('tablet and desktop begin closer while mobile retains original zoom', () => {
  assert.match(html, /window\.innerWidth>=768\?7\.1:8\.5/);
  assert.match(html, /zoom=8\.5,targetX=/);
});

test('initial sizing and Reset view share the same responsive zoom calculation', () => {
  const occurrences = html.split(defaultZoom).length - 1;
  assert.equal(occurrences, 3, 'default, reset and resize must use the same calculation');
});

test('existing user zoom remains untouched on resize', () => {
  assert.match(html, /if\(!canvas\.dataset\.userZoom\)\{zoom=Math\.max\(window\.innerWidth>=768/);
});

test('manual zoom limits are preserved', () => {
  assert.match(html, /zoom=Math\.max\(5\.5,zoom-\.65\)/);
  assert.match(html, /zoom=Math\.min\(14,zoom\+\.65\)/);
});
