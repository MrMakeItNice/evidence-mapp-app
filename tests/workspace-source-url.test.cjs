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
const { targetUrl, sourceAnchor, sourceLibraryLink } = vm.runInNewContext(
  html.slice(start, end) + '\n({ targetUrl, sourceAnchor, sourceLibraryLink })',
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
  assert.match(html, /const sourceAnchor = \(s,text\)=>\{[\s\S]*?const safe=targetUrl\(s\?\.url\)/);
  assert.match(html, /function sourcesScreen\(\)[\s\S]*?sourceLibraryLink\(s\)/);
  assert.match(html, /function timelineScreen\(\)[\s\S]*?targetUrl\(e\.url\)/);
  assert.doesNotMatch(html, /href="\$\{esc\(s\.url\)\}"/);
});


test('other workspace previews disclose destination hosts and escape unsafe metadata', () => {
  const preview = sourceAnchor({
    title: 'Agency <record>',
    publisher: 'agency.gov',
    url: 'https://agency.gov.attacker.example:8443/report?document=A%2FB&lang=en#page=3'
  }, 'Open original source ↗');
  assert.ok(preview.includes('Destination: agency.gov.attacker.example:8443 · indexed URL only'));
  assert.ok(preview.includes('href="https://agency.gov.attacker.example:8443/report?document=A%2FB&amp;lang=en#page=3"'));
  assert.ok(preview.includes('aria-label="Open original source — indexed destination agency.gov.attacker.example:8443 (new tab; provenance not independently verified)"'));
  assert.ok(!preview.includes('source ↗ ↗'));
  const escaped = sourceAnchor({ title: '<script>alert(1)</script>', url: 'https://example.org/report' });
  assert.ok(escaped.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!escaped.includes('<script>'));
  const blocked = sourceAnchor({ title: 'Untrusted record', url: 'https://agency.gov@attacker.example/report' });
  assert.equal(blocked, 'Untrusted record');
});

test('Source Library discloses the actual indexed destination host and port', () => {
  const html = sourceLibraryLink({
    title: 'Records <Archive> & notes',
    url: 'https://Records.example:8443/docs?id=A%2FB&lang=en#page=7'
  });
  assert.match(html, /href="https:\/\/records\.example:8443\/docs\?id=A%2FB&amp;lang=en#page=7"/);
  assert.match(html, /Destination: records\.example:8443/);
  assert.match(html, /not independently verified/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /aria-label="Open indexed source link for Records &lt;Archive&gt; &amp; notes at records\.example:8443 \(new tab\)"/);
});

test('Source Library never hides a misleading hostname behind a publisher label', () => {
  const misleading = sourceLibraryLink({
    title: 'Official agency report',
    url: 'https://agency.gov.attacker.example/document'
  });
  assert.match(misleading, /Destination: agency\.gov\.attacker\.example/);
  assert.doesNotMatch(misleading, /Destination: agency\.gov\s/);
  const rejected = sourceLibraryLink({
    title: 'Official agency report',
    url: 'https://agency.gov@attacker.example/document'
  });
  assert.match(rejected, /Source URL unavailable or blocked/);
  assert.doesNotMatch(rejected, /<a\b/);
});

test('Source Library does not make invalid URLs clickable', () => {
  for (const value of ['', null, undefined, 'javascript:alert(1)', 'https://name:password@bad.example/file']) {
    const html = sourceLibraryLink({ title: 'Citation', url: value });
    assert.match(html, /Source URL unavailable or blocked/);
    assert.doesNotMatch(html, /href=/);
  }
});

test('workspace inline scripts retain valid JavaScript syntax', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [i, match] of scripts.entries()) {
    if (match[1].trim()) new vm.Script(match[1], { filename: 'workspace-script-' + i });
  }
});
