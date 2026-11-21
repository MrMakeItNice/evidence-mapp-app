import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectSourceUrl, reviewSourceUrls } from '../scripts/review-source-urls.mjs';

test('finds tracking-only near-duplicates but retains evidence identifiers', () => {
  const data = reviewSourceUrls([
    { id: 1, url: 'https://example.org/document?id=123&utm_source=rss#section' },
    { id: 2, url: 'https://example.org/document?id=123' },
    { id: 3, url: 'https://example.org/document?id=124' },
  ]);
  assert.deepEqual(data.duplicate_suggestions, [{ normalized_url: 'https://example.org/document?id=123', ids: [1, 2] }]);
  assert.equal(data.record_count, 3);
});

test('flags malformed semicolon query keys without conflating distinct ECHR documents', () => {
  const data = reviewSourceUrls([
    { id: 8, url: 'https://hudoc.echr.coe.int/app/conversion/pdf/?id=003-111&library=ECHR' },
    { id: 9, url: 'https://hudoc.echr.coe.int/app/conversion/pdf/?id=003-222&library=ECHR' },
    { id: 10, url: 'https://hudoc.echr.coe.int/app/conversion/pdf/?id;=003-333&library;=ECHR' },
  ]);
  assert.deepEqual(data.duplicate_suggestions, []);
  assert.deepEqual(data.issues.map(item => item.id), [10]);
  assert.ok(data.issues[0].flags.includes('suspicious_semicolon_query_key'));
});

test('classifies missing, invalid, unsupported and proxy URLs without claiming verification', () => {
  const data = reviewSourceUrls([
    { id: 1, source_url: '' },
    { id: 2, source_url: 'not an url' },
    { id: 3, source_url: 'javascript:alert(1)' },
    { id: 4, source_url: 'https://news.google.com/rss/articles/abc' },
    { id: 5, source_url: 'http://example.org/source' },
  ]);
  assert.deepEqual(data.issues.map(item => item.flags), [
    ['missing_url'], ['invalid_url'], ['unsupported_scheme'],
    ['google_news_proxy_review_publisher'], ['unencrypted_http'],
  ]);
  assert.deepEqual(data.duplicate_suggestions, []);
});

test('never automatically strips functional query fields or mutates source input', () => {
  const source = { id: 12, url: 'https://example.org/file?filename=Doc.pdf&id=42&gclid=ad' };
  const before = structuredClone(source);
  assert.equal(inspectSourceUrl(source.url).normalized_url, 'https://example.org/file?filename=Doc.pdf&id=42');
  reviewSourceUrls([source]);
  assert.deepEqual(source, before);
  assert.throws(() => reviewSourceUrls({}), TypeError);
});
