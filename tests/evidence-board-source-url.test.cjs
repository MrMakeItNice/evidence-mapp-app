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


test('rejects source URLs carrying embedded usernames or passwords', () => {
  for (const address of [
    'https://reader@archives.gov/record',
    'https://reader:secret@archives.gov/record',
    'https://:secret@archives.gov/record',
    'http://reader@archives.gov/record',
    'https://agency.gov@attacker.example/record',
  ]) {
    assert.equal(safeSourceUrl(address), null, address);
  }
  const publicRecord = 'https://archives.gov/report?id=42#page=2';
  assert.equal(safeSourceUrl(publicRecord), publicRecord);
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


// Exercise the actual board helper: source identity matters for evidence trails.
function indexedDocs(references, caseId) {
  const helper = html.match(/function uniqueDocs\(id\)\{[\s\S]*?\}function nodePos/);
  assert.ok(helper, 'Evidence Board must define uniqueDocs before nodePos');
  const src = helper[0].slice(0, -'function nodePos'.length);
  const uniqueDocs = vm.runInNewContext(src + ';uniqueDocs', { refs: references, safeSourceUrl });
  return uniqueDocs(caseId);
}

test('preserves distinct trailing slash, query, and fragment citation URLs', () => {
  const urls = [
    'https://records.example/report',
    'https://records.example/report/',
    'https://records.example/document?id=1',
    'https://records.example/document?id=2',
    'https://records.example/document?id=2#page=3',
  ];
  const records = urls.map(url => ({ case_id: 7, url }));
  assert.deepEqual(indexedDocs(records, 7).map(record => record.url), urls);
});

test('deduplicates only browser-equivalent citation URLs', () => {
  const records = [
    { case_id: 'MK', url: 'https://ARCHIVE.EXAMPLE:443/file?id=1' },
    { case_id: 'MK', url: 'https://archive.example/file?id=1' },
    { case_id: 'MK', url: 'http://archive.example/file?id=1' },
    { case_id: 'OTHER', url: 'https://archive.example/file?id=2' },
    { case_id: 'MK', url: 'javascript:alert(1)' },
  ];
  assert.deepEqual(indexedDocs(records, 'MK').map(record => record.url), [
    'https://ARCHIVE.EXAMPLE:443/file?id=1',
    'http://archive.example/file?id=1',
  ]);
});

test('keeps the 12-citation board cap without collapsing unique document IDs', () => {
  const records = Array.from({ length: 14 }, (_, index) => ({
    case_id: 1, url: 'https://archive.example/document?id=' + index,
  }));
  assert.deepEqual(indexedDocs(records, 1).map(record => record.url),
    records.slice(0, 12).map(record => record.url));
});
