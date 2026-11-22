// Regression coverage for source links rendered by the private workspace.
// Run: node --test tests/workspace-source-url.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'workspace.html'), 'utf8');
const start = html.indexOf('const targetUrl = u=>');
const end = html.indexOf('\nconst label = ', start);
assert.ok(start >= 0 && end > start, 'Workspace source URL and anchor helpers exist');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const { targetUrl, sourceAnchor } = vm.runInNewContext(
  html.slice(start, end) + '\n({ targetUrl, sourceAnchor })',
  { URL, esc }
);

test('keeps normal absolute HTTP(S) source URLs with document identifiers', () => {
  assert.equal(targetUrl('https://Example.org/doc?item=123&lang=en#page=4'),
    'https://example.org/doc?item=123&lang=en#page=4');
  assert.equal(targetUrl('http://example.org:8080/file'), 'http://example.org:8080/file');
  assert.equal(targetUrl('  https://example.org/archive%20copy  '),
    'https://example.org/archive%20copy');
});

test('rejects forged agency URLs containing username or password', () => {
  for (const value of [
    'https://agency.gov@attacker.example/report',
    'https://user:password@attacker.example/report',
    'https://agency.gov%40fake@attacker.example/report',
    'http://person@attacker.example/file'
  ]) {
    assert.equal(targetUrl(value), null, value);
  }
});

test('rejects malformed, scheme-disguised and control-bearing destinations', () => {
  for (const value of [
    'javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd',
    'blob:https://example.org/report', 'httpsx://example.org/report',
    '/report', '//example.org/report', 'not a url', '', null, undefined,
    'https:///example.org/report', 'https://example.org\\@attacker.example',
    'https://example.org/file\n@attacker.example',
    'https://example.org/file\t?x=1',
    'https://example.org\\path'
  ]) {
    assert.equal(targetUrl(value), null, String(value));
  }
});

test('unsafe source links display escaped metadata without a clickable destination', () => {
  const title = '<Agency record & notes>';
  const blocked = sourceAnchor({
    title, url: 'https://official.gov@attacker.example/document'
  });
  assert.equal(blocked, '&lt;Agency record &amp; notes&gt;');
  assert.doesNotMatch(blocked, /<a\b/i);
  const safe = sourceAnchor({
    title, url: 'https://example.org/report?id=1&lang=en'
  });
  assert.match(safe, /href="https:\/\/example\.org\/report\?id=1&amp;lang=en"/);
  assert.match(safe, /rel="noopener noreferrer"/);
  assert.match(safe, /&lt;Agency record &amp; notes&gt;/);
});

test('source-library and dated-timeline links remain routed through the policy', () => {
  assert.match(html, /const sourceAnchor = .*?targetUrl\(s\.url\)/);
  assert.match(html, /function sourcesScreen\(\)[\s\S]*?sourceAnchor\(s,'View source'\)/);
  assert.match(html, /function timelineScreen\(\)[\s\S]*?targetUrl\(e\.url\)/);
  assert.doesNotMatch(html, /href="\$\{esc\(s\.url\)\}"/);
});

test('workspace inline scripts retain valid JavaScript syntax', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [i, match] of scripts.entries()) {
    if (match[1].trim()) new vm.Script(match[1], { filename: 'workspace-script-' + i });
  }
});
