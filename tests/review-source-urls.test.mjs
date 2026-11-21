import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectSourceUrl, reviewSourceUrls } from '../scripts/review-source-urls.mjs';

test('finds tracking-only near-duplicates but retains evidence identifiers', () => {
  const data = reviewSourceUrls([
    { id: 1, url: 'https://example.org/document?id=123&utm_source=rss#section' },
    { id: 2, url: 'https://example.org/document?id=123' },
    { id: 3, url: 'https://example.org/document?id=124' },
  ]);
  assert.deepEqual(data.duplicate_suggestions, [{ ids: [1, 2] }]);
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

test('keeps sensitive credentials and unparseable values out of review output', () => {
  const rows = [
    { id: 70, url: 'https://alice:credential123@example.org/private?token=token123&id=1' },
    { id: 71, url: 'https://example.org/private?API_KEY=secret123' },
    { id: 72, url: 'not a url?password=badsecret123' },
    { id: 73, url: 'javascript:alert("hidden123")' },
    { id: 74, url: 'https://example.org/document?id=123' },
  ];
  const output = reviewSourceUrls(rows);
  assert.equal(output.record_count, 5);
  assert.equal(output.duplicate_suggestions.length, 0);
  assert.ok(output.issues[0].flags.includes('sensitive_credentials_in_url'));
  assert.ok(output.issues[1].flags.includes('sensitive_credentials_in_url'));
  assert.equal(inspectSourceUrl(rows[0].url).normalized_url, null);
  const rendered = JSON.stringify(output);
  for (const secret of ['credential123', 'token123', 'secret123', 'badsecret123', 'hidden123']) {
    assert.equal(rendered.includes(secret), false, `leaked ${secret}`);
  }
  assert.equal(rows[0].url.includes('credential123'), true, 'input record is not modified');
});


test('review output contains only trusted record IDs and flags, not opaque URL values', () => {
  const opaque = 'private-opaque-credential-9471';
  const records = [
    { id: 88, url: 'https://news.google.com/rss/articles/' + opaque + '?unknown=' + opaque },
    { id: 89, url: 'https://example.org/document?identifier=' + opaque },
    { id: 90, url: 'https://example.org/document?identifier=' + opaque + '&utm_source=email' },
    { id: opaque, url: 'not a valid URL' },
  ];
  const output = reviewSourceUrls(records);
  assert.deepEqual(output.duplicate_suggestions, [{ ids: [89, 90] }]);
  assert.deepEqual(output.issues[0], { id: 88, flags: ['google_news_proxy_review_publisher'] });
  assert.deepEqual(output.issues[1], { id: 'row_4', flags: ['invalid_url'] });
  assert.equal(JSON.stringify(output).includes(opaque), false);
  assert.equal(records[0].url.includes(opaque), true, 'input remains untouched');
});
