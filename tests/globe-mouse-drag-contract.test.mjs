// Run: node --test tests/globe-mouse-drag-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('mouse drag prevents native text selection without cancelling touch scrolling', () => {
  assert.match(html, /canvas\.addEventListener\('pointerdown',e=>\{if\(e\.pointerType==='mouse'\)e\.preventDefault\(\)/);
  assert.match(html, /\.globe-canvas\{[^}]*user-select:none;-webkit-user-select:none/);
  assert.match(html, /\.globe-canvas\{[^}]*touch-action:pan-y/);
});

test('globe still captures pointer input for rotation', () => {
  assert.match(html, /canvas\.setPointerCapture\(e\.pointerId\)/);
  assert.match(html, /canvas\.addEventListener\('pointermove'/);
  assert.match(html, /canvas\.addEventListener\('pointerup'/);
});
