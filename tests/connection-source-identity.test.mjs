import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

// Evaluate the exact helper shipped in the page, not a second implementation.
const html = readFileSync(new URL('../connection-explorer.html', import.meta.url), 'utf8');
const start = html.indexOf('function urlKey(u){');
const end = html.indexOf('function detail(', start);
assert.ok(start >= 0 && end > start, 'Connection Explorer URL identity helper exists');
const urlKey = runInNewContext(html.slice(start, end) + ';urlKey', { URL });

test('different document identifiers on the same endpoint stay distinct', () => {
  const a = 'https://hudoc.echr.coe.int/api/pdf?itemid=001-100';
  const b = 'https://hudoc.echr.coe.int/api/pdf?itemid=001-101';
  assert.notEqual(urlKey(a), urlKey(b));
  assert.notEqual(
    urlKey('https://hudoc.echr.coe.int/api/pdf?id;=abc'),
    urlKey('https://hudoc.echr.coe.int/api/pdf?id=abc')
  );
});

test('query ordering and page fragments do not create false duplicates', () => {
  const a = 'https://records.example/record?series=12&document=41';
  const b = 'https://RECORDS.EXAMPLE:443/record?document=41&series=12#page=3';
  assert.equal(urlKey(a), urlKey(b));
  assert.notEqual(urlKey(a), urlKey('https://records.example/record?series=12&document=42'));
});


test('slash-sensitive source endpoints do not merge unrelated document paths', () => {
  const file = 'https://records.example/public/report';
  const directory = 'https://records.example/public/report/';
  assert.notEqual(urlKey(file), urlKey(directory));
  assert.notEqual(urlKey('https://records.example/'), urlKey('https://records.example/public/'));
  assert.equal(urlKey(directory + '?document=41#page=1'), urlKey(directory + '?document=41#page=9'));
});

test('different origins are not merged', () => {
  assert.notEqual(urlKey('http://records.example/doc'), urlKey('https://records.example/doc'));
  assert.notEqual(urlKey('https://records.example/doc'), urlKey('https://other.example/doc'));
});

test('both case cards and cross-case source lookups use the same document key', () => {
  assert.match(html, /const k=urlKey\(r\.url\)/);
  assert.match(html, /const key=urlKey\(r\.url\)/);
  assert.match(html, /byUrl\.get\(key\)/);
});
