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
