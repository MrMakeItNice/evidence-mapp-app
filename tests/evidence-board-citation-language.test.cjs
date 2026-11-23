// Evidence Board source previews are indexed URLs, not independently authenticated publications.
// Run: node --test tests/evidence-board-citation-language.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const html = readFileSync(join(__dirname, '..', 'evidence-board.html'), 'utf8');

test('initial loading text does not imply source provenance is verified', () => {
  assert.match(html, /Loading indexed case citations…/);
  assert.doesNotMatch(html, /Loading source-backed evidence/);
});

test('board cards identify indexed citations rather than authenticated source documents', () => {
  assert.match(html, /n\.case\?'INVESTIGATION':'INDEXED CITATION'/);
  assert.match(html, /Indexed source citation · not independently verified/);
  assert.doesNotMatch(html, /'SOURCE DOCUMENT'/);
});

test('source inspector describes validated indexed URL without authenticating its publisher', () => {
  assert.match(html, /const url=safeSourceUrl\(n\.item\.url\);if\(url\)/);
  assert.match(html, /a\.href=url;a\.target='_blank';a\.rel='noopener noreferrer'/);
  assert.match(html, /Open indexed URL at /);
  assert.doesNotMatch(html, /Open original source on /);
  assert.match(html, /opening that URL does not verify its publisher or claims/);
});

test('touch and keyboard readers can inspect a citation without double-clicking', () => {
  assert.match(html, /select to inspect indexed source link/);
  assert.match(html, /Select a card to inspect its indexed URL/);
  assert.match(html, /card\.addEventListener\('keydown',e=>\{if\(\(?e\.key==='Enter'\|\|e\.key===' '\)/);
  assert.match(html, /card\.addEventListener\('pointerup'/);
});
