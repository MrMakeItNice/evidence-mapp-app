// Regression tests for the URL policy used by Evidence Board source cards.
// Run: node --test tests/evidence-board-source-url.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'evidence-board.html'), 'utf8');
const match = html.match(/function safeSourceUrl\(value\)\{.*?\}catch\{return null\}\}/);
assert.ok(match, 'Evidence Board must define safeSourceUrl');
const safeSourceUrl = vm.runInNewContext(match[0] + ';safeSourceUrl', { URL });

test('accepts absolute HTTP and HTTPS source links', () => {
  assert.equal(safeSourceUrl('https://example.org/report'), 'https://example.org/report');
  assert.equal(safeSourceUrl('http://example.org/doc'), 'http://example.org/doc');
});

test('rejects script, data, file, relative, and malformed links', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd', '/relative', '//example.org', 'not a url', '', null]) {
    assert.equal(safeSourceUrl(value), null, String(value));
  }
});

test('does not treat misleading scheme prefixes as HTTP(S)', () => {
  for (const value of ['httpsx://example.org', 'javascript:https://example.org', 'blob:https://example.org/id']) {
    assert.equal(safeSourceUrl(value), null, value);
  }
});

test('source indexing and external opening validate URLs', () => {
  assert.match(html, /function uniqueDocs\(id\)\{[^}]*safeSourceUrl\(r\.url\)/);
  assert.ok(html.includes("card.addEventListener('dblclick',()=>{if(!n.case){const url=safeSourceUrl(n.item.url);"));
  assert.match(html, /if\(url\)window\.open\(url,/);
});

test('source inspector validates the hyperlink at render time', () => {
  assert.match(html, /function showDetails\(n\)[\s\S]*?const url=safeSourceUrl\(n\.item\.url\);if\(url\)\{const a=document\.createElement\('a'\);a\.href=url;/);
  assert.doesNotMatch(html, /a\.href=n\.item\.url/);
});

test('preserves HTTPS source paths, queries, and fragments', () => {
  const url = 'https://archive.example.org/report%20one.pdf?edition=2#page=4';
  assert.equal(safeSourceUrl(url), url);
});

test('rejects non-web protocols even when a web URL appears in the payload', () => {
  for (const value of ['mailto:editor@example.org', 'ftp://example.org/report', 'data:text/html,https://example.org', 'javascript:location.href="https://example.org"']) {
    assert.equal(safeSourceUrl(value), null, value);
  }
});
