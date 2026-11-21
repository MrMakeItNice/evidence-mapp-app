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
