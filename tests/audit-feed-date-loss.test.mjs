import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditFeedDateLoss } from '../scripts/audit-feed-date-loss.mjs';

const url = 'https://news.google.com/rss/articles/example';

test('flags missing saved date only when a matching RSS entry supplies parseable pubDate', () => {
  const r = auditFeedDateLoss({
    capturedEntries: [{ entry_id: 101, source_url: url, pubDate: 'Sat, 21 Nov 2026 18:30:00 GMT' }],
    newsItems: [{ id: 202, source_url: url, published_at: null }]
  });
  assert.equal(r.candidate_date_loss, 1);
  assert.equal(r.sample_candidates[0].news_id, 202);
  assert.equal(r.sample_candidates[0].supplied_feed_field, 'pubDate');
  assert.equal(JSON.stringify(r).includes(url), false);
});

test('prefers ISO metadata and never substitutes discovery time for publication', () => {
  const r = auditFeedDateLoss({
    capturedEntries: [{ entry_id: 1, source_url: url, isoDate: '2026-11-20T11:30:00Z', pubDate: 'Fri, 20 Nov 2026 11:30:00 GMT' }],
    newsItems: [{ id: 2, source_url: url, published_at: '' }]
  });
  assert.equal(r.sample_candidates[0].supplied_feed_field, 'isoDate');
  const s = auditFeedDateLoss({
    capturedEntries: [{ entry_id: 1, source_url: url, discovered_at: '2026-11-21T12:00:00Z' }],
    newsItems: [{ id: 2, source_url: url }]
  });
  assert.equal(s.candidate_date_loss, 0);
  assert.equal(s.no_parseable_feed_date, 1);
});

test('does not claim loss for existing database dates or malformed feed metadata', () => {
  const a = auditFeedDateLoss({
    capturedEntries: [{ entry_id: 1, source_url: url, pubDate: 'Sat, 21 Nov 2026 18:30:00 GMT' }],
    newsItems: [{ id: 2, source_url: url, published_at: '2026-11-21T18:30:00Z' }]
  });
  assert.equal(a.db_publication_present, 1);
  const b = auditFeedDateLoss({
    capturedEntries: [{ entry_id: 1, source_url: url, pubDate: 'yesterday' }],
    newsItems: [{ id: 2, source_url: url, published_at: null }]
  });
  assert.equal(b.no_parseable_feed_date, 1);
});

test('ambiguous captured or saved URLs cannot produce candidates', () => {
  const a = auditFeedDateLoss({
    capturedEntries: [
      { entry_id: 1, source_url: url, pubDate: 'Sat, 21 Nov 2026 18:30:00 GMT' },
      { entry_id: 2, source_url: url, pubDate: 'Sat, 21 Nov 2026 18:30:00 GMT' }
    ], newsItems: [{ id: 3, source_url: url }]
  });
  assert.equal(a.ambiguous_url_groups, 1);
  assert.equal(a.candidate_date_loss, 0);
  const b = auditFeedDateLoss({
    capturedEntries: [{ entry_id: 1, source_url: url, pubDate: 'Sat, 21 Nov 2026 18:30:00 GMT' }],
    newsItems: [{ id: 3, source_url: url }, { id: 4, source_url: url }]
  });
  assert.equal(b.ambiguous_url_groups, 1);
  assert.equal(b.candidate_date_loss, 0);
});

test('rejects credential-bearing and sensitive URLs, never logs secrets or input URLs', () => {
  const secret = 'private-test-secret';
  const r = auditFeedDateLoss({
    capturedEntries: [
      { entry_id: 1, source_url: 'https://news.google.com/a?token=' + secret, pubDate: 'Sat, 21 Nov 2026 18:30:00 GMT' },
      { entry_id: 2, source_url: 'https://user:' + secret + '@news.google.com/b', pubDate: 'Sat, 21 Nov 2026 18:30:00 GMT' },
      { entry_id: 3, source_url: url, pubDate: 'Sat, 21 Nov 2026 18:30:00 GMT' }
    ], newsItems: [{ id: 4, source_url: url, published_at: null }]
  });
  assert.equal(r.ignored_captured_rows, 2);
  assert.equal(r.candidate_date_loss, 1);
  assert.equal(JSON.stringify(r).includes(secret), false);
  assert.equal(JSON.stringify(r).includes(url), false);
});

test('does not mutate source snapshots and rejects malformed input shapes', () => {
  const feed = Object.freeze({ entry_id: 1, source_url: url, pubDate: 'Sat, 21 Nov 2026 18:30:00 GMT' });
  const news = Object.freeze({ id: 2, source_url: url, published_at: null });
  auditFeedDateLoss({ capturedEntries: [feed], newsItems: [news] });
  assert.equal(news.published_at, null);
  assert.throws(() => auditFeedDateLoss({ capturedEntries: {} }), TypeError);
  assert.throws(() => auditFeedDateLoss({ newsItems: new Array(100001) }), TypeError);
});
