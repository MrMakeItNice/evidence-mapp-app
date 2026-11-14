// Run: node --test tests/evidence-board-source-url.test.cjs
// Tests the actual inline helper from the Evidence Board, not a copied implementation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'evidence-board.html'), 'utf8');
const match = html.match(/function safeSourceUrl\(value\)\{.*?\}\}/s);
assert.ok(match, 'Evidence Board must expose safeSourceUrl for link validation');
const safeSourceUrl = vm.runInNewContext('(' + match[0] + ')', { URL });

test('accepts absolute HTTP(S) source links', () => {
  assert.equal(safeSourceUrl('https://example.org/source?id=1'), 'https://example.org/source?id=1');
  assert.equal(safeSourceUrl('http://example.org/report'), 'http://example.org/report');
});

test('rejects executable, embedded, local, and relative destinations', () => {
  for (const url of [
    'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)', 'file:///etc/passwd', 'blob:https://example.org/id',
    '//example.org/source', '/relative/source', 'not a url', '', null, undefined,
  ]) {
    assert.equal(safeSourceUrl(url), null, String(url));
  }
});

test('normalizes safe URLs without accepting leading executable schemes', () => {
  assert.equal(safeSourceUrl(' https://example.org/a '), 'https://example.org/a');
  assert.equal(safeSourceUrl(' javascript:alert(1) '), null);
});

test('source cards and inspector both use URL validation', () => {
  assert.match(html, /function uniqueDocs\(id\).*?safeSourceUrl\(r\.url\)/s);
  assert.match(html, /a\.href=safeSourceUrl\(n\.item\.url\)/);
});
