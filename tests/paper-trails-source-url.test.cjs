// Validate the Paper Trails source destination policy without contacting publishers.
// Run: node --test tests/paper-trails-source-url.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'paper-trails.html'), 'utf8');
const start = html.indexOf('const valid=x=>{');
const end = html.indexOf(';let cases=', start);
assert.ok(start >= 0 && end > start, 'Paper Trails HTTPS source validator exists');
const valid = vm.runInNewContext(html.slice(start, end) + ';valid', { URL });

test('accepts absolute HTTPS citations, including identifiers and page fragments', () => {
  for (const url of [
    'https://www.archives.gov/report?id=42#page=2',
    'https://records.example.org/archive?username=reader',
    'https://records.example.org:8443/document'
  ]) assert.equal(valid(url), url);
});

test('rejects source URLs containing embedded usernames or passwords', () => {
  for (const url of [
    'https://reader@archives.gov/report',
    'https://reader:password@archives.gov/report',
    'https://:password@archives.gov/report',
    'https://archives.gov@untrusted.example/report',
    'https://reader@archives.gov:8443/report'
  ]) assert.equal(valid(url), null, url);
});

test('continues rejecting HTTP, scripts, data URLs and relative paths', () => {
  for (const url of [
    'http://archives.gov/report',
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///tmp/file',
    '//archives.gov/report',
    '/reports/1',
    'not a URL',
    '', null
  ]) assert.equal(valid(url), null, String(url));
});

test('the case source list and document timeline both use the guarded URL', () => {
  assert.match(html, /const u=valid\(r\.url\)[,;]/);
  assert.match(html, /\(valid\(r\.url\)\?'<a href=/);
});

test('Paper Trails inline JavaScript remains syntactically valid', () => {
  const inlineScripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(inlineScripts.length > 0);
  for (const script of inlineScripts) assert.doesNotThrow(() => new vm.Script(script[1]));
});
