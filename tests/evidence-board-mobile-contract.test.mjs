// Static regression checks for the mobile Evidence Board interaction contract.
// Run: node --test tests/evidence-board-mobile-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../evidence-board.html', import.meta.url), 'utf8');

test('mobile board stacks columns and gives the canvas a usable height', () => {
  assert.match(html, /@media\(max-width:650px\)\{\.shell\{display:block\}/);
  assert.match(html, /\.viewport\{height:540px\}/);
  assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1">/);
});

test('touch dragging is constrained to the interactive canvas and cards', () => {
  assert.match(html, /\.viewport\{[^}]*touch-action:none/);
  assert.match(html, /\.tile\{[^}]*touch-action:none/);
  assert.match(html, /viewport\.setPointerCapture\(e\.pointerId\)/);
  assert.match(html, /card\.setPointerCapture\(e\.pointerId\)/);
  assert.match(html, /pointercancel/);
});

test('zoom and reset remain available without gesture input', () => {
  for (const id of ['zin', 'zout', 'reset']) {
    assert.match(html, new RegExp('<button id="'+id+'">'));
    assert.match(html, new RegExp("\\$\\('"+id+"'\\)\\.addEventListener\\('click'"));
  }
  assert.match(html, /Math\.max\(\.35,Math\.min\(2,zoom\*f\)\)/);
});

test('keyboard users can inspect a source card', () => {
  assert.match(html, /card\.tabIndex=0/);
  assert.match(html, /card\.setAttribute\('role','button'\)/);
  assert.match(html, /e\.key==='Enter'\|\|e\.key===' '/);
  assert.match(html, /showDetails\(n\)/);
});

test('mobile interactions do not silently invent evidence', () => {
  assert.match(html, /No sample evidence has been substituted/);
  assert.match(html, /An edge does not establish causation or misconduct/);
});
