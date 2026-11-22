import test from 'node:test';
import assert from 'node:assert/strict';
import { triageReviewQueue } from '../scripts/triage-review-queue.mjs';

const asOf = '2026-11-22T08:36:00Z';
function snapshot() {
  const news_items = [
    {
      id: 1, source_url: 'https://agency.gov/report/1', content_kind: 'primary_document',
      published_at: null, discovered_at: '2026-10-20T00:00:00Z',
      review_status: 'pending', headline: 'PRIVATE TITLE'
    },
    {
      id: 2, source_url: 'https://news.google.com/articles/abc', content_kind: 'news_report',
      published_at: null, discovered_at: '2026-11-21T00:00:00Z',
      review_status: 'pending'
    },
    {
      id: 3, source_url: 'https://news.google.com.evil.test/abc', content_kind: 'news_report',
      published_at: null, discovered_at: '2026-11-21T01:00:00Z',
      review_status: 'pending'
    },
    {
      id: 4, source_url: 'https://agency.gov/report/4', content_kind: 'legal_record',
      published_at: null, discovered_at: '2026-10-15T00:00:00Z',
      review_status: 'reviewed'
    }
  ];
  const research_inbox = [
    {
      id: 11, source_url: 'https://agency.gov/report/1',
      discovered_at: '2026-10-20T00:00:00Z',
      review_status: 'pending', watch_topic_id: null, published_at: '2026-10-19T00:00:00Z'
    },
    {
      id: 12, source_url: 'https://agency.gov/other',
      discovered_at: '2026-11-21T00:00:00Z',
      review_status: 'reviewed', watch_topic_id: 5, published_at: '2026-11-20T00:00:00Z'
    }
  ];
  const sources = [
    { id: 21, url: 'https://agency.gov/report/1', published: true, title: 'PRIVATE SOURCE' },
    { id: 22, url: null, title: 'PLACEHOLDER' }
  ];
  return {
    as_of: asOf,
    expected_counts: { news_items: 4, research_inbox: 2, sources: 2 },
    news_items, research_inbox, sources
  };
}

test('complete snapshot produces bounded ID-only results', () => {
  const r = triageReviewQueue(snapshot());
  assert.deepEqual(r.totals, {
    news_items: 4, research_inbox: 2, sources: 2,
    candidates: 4, shown: 4, omitted: 0
  });
  assert.deepEqual(r.review_queue.map(x => [x.queue, x.id]), [
    ['news_items', 1], ['research_inbox', 11], ['news_items', 2], ['news_items', 3]
  ]);
});

test('prioritizes source and cross-queue leads without merging', () => {
  const r = triageReviewQueue(snapshot());
  const news = r.review_queue[0];
  assert.equal(news.priority, 100);
  assert.deepEqual(news.reasons, [
    'primary_kind_missing_date', 'shared_source_record_url',
    'shared_news_inbox_url', 'aged_pending_14d'
  ]);
  assert.equal(r.reason_counts.shared_news_inbox_url, 2);
  assert.equal(r.reason_counts.shared_source_record_url, 1);
  assert.equal(r.reason_counts.inbox_unassigned_watch, 1);
});

test('Google News proxy check uses hostname, not substring', () => {
  const r = triageReviewQueue(snapshot());
  assert.equal(r.reason_counts.google_proxy_missing_date, 1);
  assert.equal(r.reason_counts.other_missing_date, 1);
  const spoofed = r.review_queue.find(x => x.id === 3);
  assert.ok(spoofed.reasons.includes('other_missing_date'));
  assert.ok(!spoofed.reasons.includes('google_proxy_missing_date'));
});

test('reviewed records stay out and source rows are never candidates', () => {
  const r = triageReviewQueue(snapshot());
  assert.ok(!r.review_queue.some(x => x.queue === 'news_items' && x.id === 4));
  assert.ok(!r.review_queue.some(x => x.queue === 'research_inbox' && x.id === 12));
  assert.ok(!r.review_queue.some(x => x.queue === 'sources'));
});

test('never outputs titles, URLs, notes, or other user input text', () => {
  const data = snapshot();
  data.news_items[0].evidence_notes = 'SECRET_EVIDENCE_PAYLOAD';
  const result = JSON.stringify(triageReviewQueue(data));
  for (const term of ['PRIVATE TITLE', 'PRIVATE SOURCE', 'SECRET_EVIDENCE_PAYLOAD', 'agency.gov', 'news.google.com']) {
    assert.ok(!result.includes(term));
  }
});

test('limit changes displayed subset but not aggregate counts', () => {
  const r = triageReviewQueue(snapshot(), { limit: 2 });
  assert.equal(r.totals.candidates, 4);
  assert.equal(r.totals.shown, 2);
  assert.equal(r.totals.omitted, 2);
  assert.equal(r.review_queue.length, 2);
});

test('rejects invalid expected counts and missing collection', () => {
  const data = snapshot(); data.expected_counts.news_items = 100;
  assert.throws(() => triageReviewQueue(data), /Incomplete snapshot/);
  delete data.research_inbox;
  assert.throws(() => triageReviewQueue(data), /Incomplete snapshot/);
});

test('rejects repeated IDs in the same collection', () => {
  const data = snapshot(); data.news_items[1].id = 1;
  assert.throws(() => triageReviewQueue(data), /Invalid record identifier/);
});

test('rejects URL userinfo, bad protocols, whitespace and invalid timestamps', () => {
  for (const url of ['file:///tmp/a', 'https://someone:secret@agency.gov/a',
    'https://agency.gov/ a']) {
    const data = snapshot(); data.news_items[0].source_url = url;
    assert.throws(() => triageReviewQueue(data), /Invalid URL/);
  }
  const data = snapshot(); data.news_items[0].discovered_at = '2026-10-20';
  assert.throws(() => triageReviewQueue(data), /Invalid timestamp/);
});

test('rejects future discovery and timestamp without timezone', () => {
  const data = snapshot(); data.news_items[0].discovered_at = '2026-12-20T00:00:00Z';
  assert.throws(() => triageReviewQueue(data), /future/);
  data.news_items[0].discovered_at = '2026-10-20T00:00:00';
  assert.throws(() => triageReviewQueue(data), /Invalid timestamp/);
});

test('empty complete collections are safe', () => {
  const empty = {
    as_of: asOf,
    expected_counts: { news_items: 0, research_inbox: 0, sources: 0 },
    news_items: [], research_inbox: [], sources: []
  };
  assert.deepEqual(triageReviewQueue(empty).review_queue, []);
});

test('does not mutate snapshot records or statuses', () => {
  const data = snapshot(); const before = structuredClone(data);
  triageReviewQueue(data);
  assert.deepEqual(data, before);
});

test('invalid display limit rejected rather than silently expanding output', () => {
  assert.throws(() => triageReviewQueue(snapshot(), { limit: 500 }), /Invalid audit parameters/);
  assert.throws(() => triageReviewQueue(snapshot(), { limit: 0 }), /Invalid audit parameters/);
});


test('pending inbox missing publication date is flagged without inferring a date', () => {
  const data = snapshot();
  data.research_inbox[0].published_at = null;
  const result = triageReviewQueue(data);
  assert.equal(result.reason_counts.inbox_missing_date, 1);
  assert.ok(result.review_queue.find(r => r.queue === 'research_inbox' && r.id === 11)
    .reasons.includes('inbox_missing_date'));
  assert.equal(data.research_inbox[0].published_at, null);
});

test('malformed inbox publication date rejected; reviewed undated entry is not triaged', () => {
  const data = snapshot();
  data.research_inbox[0].published_at = '2026-11-20';
  assert.throws(() => triageReviewQueue(data), /Invalid timestamp/);
  data.research_inbox[0].published_at = '2026-10-19T00:00:00Z';
  data.research_inbox[1].published_at = null;
  const result = triageReviewQueue(data);
  assert.equal(result.reason_counts.inbox_missing_date, 0);
  assert.ok(!result.review_queue.some(r => r.queue === 'research_inbox' && r.id === 12));
});

test('rejects impossible calendar dates rather than silently normalizing them', () => {
  for (const invalid of [
    '2026-02-30T12:00:00Z',
    '2026-11-31T12:00:00Z',
    '2025-02-29T12:00:00Z',
    '2026-01-01T24:00:00Z',
    '2026-01-01T10:00:00+14:30',
    '2026-01-01T10:00:00+15:00'
  ]) {
    const data = snapshot();
    data.news_items[0].discovered_at = invalid;
    assert.throws(() => triageReviewQueue(data), /Invalid timestamp/, invalid);
  }
  const valid = snapshot();
  valid.news_items[0].discovered_at = '2024-02-29T12:30:00+05:30';
  assert.doesNotThrow(() => triageReviewQueue(valid));
  valid.research_inbox[0].published_at = '2026-02-30T12:00:00Z';
  assert.throws(() => triageReviewQueue(valid), /Invalid timestamp/);
});


test('unpublished source URL matches are leads, not published corroboration', () => {
  const data = snapshot();
  data.sources[0].published = false;
  const result = triageReviewQueue(data);
  const news = result.review_queue.find(r => r.queue === 'news_items' && r.id === 1);
  assert.ok(news.reasons.includes('shared_unpublished_source_url'));
  assert.ok(!news.reasons.includes('shared_source_record_url'));
  assert.equal(result.reason_counts.shared_unpublished_source_url, 1);
  assert.equal(result.reason_counts.shared_source_record_url, 0);
});

test('unknown source publication flag does not imply source is published', () => {
  const data = snapshot();
  delete data.sources[0].published;
  const result = triageReviewQueue(data);
  const news = result.review_queue.find(r => r.queue === 'news_items' && r.id === 1);
  assert.ok(news.reasons.includes('shared_unpublished_source_url'));
  assert.ok(!news.reasons.includes('shared_source_record_url'));
  assert.equal(data.sources[0].published, undefined);
});

test('published and unpublished source records with the same URL stay separate flags', () => {
  const data = snapshot();
  data.sources.push({ id: 23, url: 'https://agency.gov/report/1', published: false });
  data.expected_counts.sources = 3;
  const result = triageReviewQueue(data);
  const news = result.review_queue.find(r => r.queue === 'news_items' && r.id === 1);
  assert.ok(news.reasons.includes('shared_source_record_url'));
  assert.ok(news.reasons.includes('shared_unpublished_source_url'));
  assert.equal(result.reason_counts.shared_source_record_url, 1);
  assert.equal(result.reason_counts.shared_unpublished_source_url, 1);
});
