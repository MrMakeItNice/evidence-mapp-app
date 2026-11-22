// Offline regression coverage for the collector's source URL policy (issue #345).
// Run: node --test tests/news-collector-url.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const collector = fs.readFileSync(
  path.join(__dirname, '..', 'supabase/functions/evidence-news-collector/index.ts'), 'utf8'
);
const match = collector.match(/function urlSafe\(v:unknown\)\{[\s\S]*?\n\}/);
assert.ok(match, 'collector must define its URL policy in urlSafe');
// The helper is ordinary JavaScript apart from its TypeScript parameter annotation.
// Execute the exact repository helper in a sandbox without invoking the Edge Function.
const urlSafe = vm.runInNewContext(match[0].replace('v:unknown', 'v') + ';urlSafe', {URL});

test('accepts ordinary HTTP(S) source URLs and preserves document query identifiers', () => {
  assert.equal(urlSafe('https://archives.gov/report?id=ABC%2F21&version=4'),
    'https://archives.gov/report?id=ABC%2F21&version=4');
  assert.equal(urlSafe('http://archive.example.org/legacy?doc=77'),
    'http://archive.example.org/legacy?doc=77');
  assert.equal(urlSafe('https://records.example.org/find?email=person%40example.org'),
    'https://records.example.org/find?email=person%40example.org');
});

test('strips only known tracking keys and the fragment while retaining document IDs', () => {
  assert.equal(
    urlSafe('https://archives.gov/report?id=42&utm_source=news&fbclid=tracker&gclid=ad#page=3'),
    'https://archives.gov/report?id=42'
  );
});

test('rejects source userinfo, including deceptive host prefixes and encoded credentials', () => {
  for (const value of [
    'https://archives.gov@unexpected.example/document',
    'https://reader:password@archives.gov/document',
    'https://reader@archives.gov/document',
    'https://:password@archives.gov/document',
    'https://%75ser:secret@archives.gov/document',
    'http://reader@archives.gov/document',
  ]) assert.equal(urlSafe(value), null, value);
});

test('rejects malformed, relative, unsupported and non-string candidates', () => {
  for (const value of [
    'javascript:alert(1)', 'data:text/html,hello', 'ftp://archives.gov/report',
    '/relative/path', '//archives.gov/report', 'not a url', '', null, undefined,
    25, {toString: () => 'https://archives.gov/report'}
  ]) assert.equal(urlSafe(value), null, String(value));
});

test('rejects overlong canonical URLs without cutting off trailing identifiers', () => {
  const prefix = 'https://archive.example.org/report?data=';
  const id = '&document=important-identifier';
  const withinLimit = prefix + 'q'.repeat(2048 - prefix.length - id.length) + id;
  assert.equal(withinLimit.length, 2048);
  assert.equal(urlSafe(withinLimit), withinLimit);
  assert.equal(urlSafe(withinLimit + 'x'), null);
  assert.equal(urlSafe(prefix + 'q'.repeat(2200) + id), null);
});

test('ingestion persists and deduplicates only the checked URL', () => {
  assert.match(collector, /const link=urlSafe\(item\?\.url\)/);
  assert.match(collector, /canonical_url:link/);
  assert.doesNotMatch(match[0], /\.slice\(0,2048\)/);
});
