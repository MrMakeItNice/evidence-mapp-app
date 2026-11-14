// Run: node --test tests/globe-touch-scroll-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('globe touch CSS allows native vertical page scrolling without conflicting overrides', () => {
  const css = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1];
  assert.ok(css, 'homepage inline stylesheet is required');
  const declarations = [...css.matchAll(/\.globe-canvas\s*\{([^}]*)\}/g)]
    .flatMap(([, body]) => [...body.matchAll(/touch-action\s*:\s*([^;!}]+)/g)].map(match => match[1].trim()));
  assert.deepEqual(declarations, ['pan-y'], 'the canvas must not override pan-y with touch-action:none');
});

test('globe retains pointer and keyboard controls while page scrolling is available', () => {
  assert.match(html, /canvas\.addEventListener\(['"]pointerdown['"]/);
  assert.match(html, /canvas\.addEventListener\(['"]pointermove['"]/);
  assert.match(html, /canvas\.addEventListener\(['"]pointercancel['"]/);
  assert.match(html, /canvas\.addEventListener\(['"]keydown['"]/);
  assert.match(html, /document\.activeElement\s*!==\s*canvas/, 'wheel zoom must not trap normal page scrolling');
});
