import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditInboxNewsOverlaps } from '../scripts/audit-inbox-news-overlaps.mjs';

const original = 'https://official.example.org/report?id=ABC&library=ENG';
const newsItem = { id: 12, headline: 'Original primary report announced', source_url: original, published_at: '2026-11-20 12:00:00+00' };
const inboxItem = { id: 5, title: 'Research: original primary report', source_url: original, published_at: '2026-11-20T00:00:00Z' };

test('detects exact source URL pair but does not equate different editorial headlines', () => {
  const result = auditInboxNewsOverlaps({inbox:[inboxItem], newsItems:[newsItem]});
  assert.equal(result.candidate_pair_count, 1);
  assert.deepEqual(result.candidate_pairs[0], {
    inbox_id: 5, news_id: 12, title_match: false, supplied_date_match: true,
    match_reason: 'identical_trimmed_url_only', review_status: 'human_review_required',
  });
});

test('preserves meaningful query identifiers and even tracking parameters', () => {
  const result = auditInboxNewsOverlaps({inbox:[inboxItem],newsItems:[
    {...newsItem,source_url:'https://official.example.org/report?id=DEF&library=ENG'},
    {...newsItem,id:13,source_url:original+'&utm_source=feed'},
  ]});
  assert.equal(result.candidate_pair_count, 0);
});

test('rejects credential-containing URLs, never echoing tokens or article text', () => {
  const secret = 'https://example.org/page?access_token=do-not-expose';
  const r = auditInboxNewsOverlaps({inbox:[{...inboxItem,source_url:secret}],newsItems:[{...newsItem,source_url:secret}]});
  assert.equal(r.candidate_pair_count,0);
  assert.equal(r.ignored_inbox_rows,1);
  assert.equal(r.ignored_news_rows,1);
  assert.ok(!JSON.stringify(r).includes('do-not-expose'));
  assert.ok(!JSON.stringify(r).includes('Research: original primary report'));
});

test('marks many-to-one URL matches ambiguous without proposing a unique link', () => {
  const r = auditInboxNewsOverlaps({inbox:[inboxItem],newsItems:[newsItem,{...newsItem,id:14}]});
  assert.equal(r.candidate_pair_count,0);
  assert.deepEqual(r.ambiguous_inbox_ids,[5]);
});

test('dates unknown when absent and title match only when supplied', () => {
  const r = auditInboxNewsOverlaps({inbox:[{...inboxItem,title:null,published_at:null}],newsItems:[newsItem]});
  assert.equal(r.candidate_pairs[0].title_match,null);
  assert.equal(r.candidate_pairs[0].supplied_date_match,null);
});

test('does not mutate frozen inputs and suppresses duplicate IDs', () => {
  const a=Object.freeze({...inboxItem});
  const b=Object.freeze({...newsItem});
  const r=auditInboxNewsOverlaps({inbox:Object.freeze([a,a]),newsItems:Object.freeze([b,b])});
  assert.equal(r.candidate_pair_count,1);
  assert.equal(r.ignored_inbox_rows,1);
  assert.equal(r.ignored_news_rows,1);
});

test('rejects malformed input, unsupported protocols and invalid IDs', () => {
  assert.throws(()=>auditInboxNewsOverlaps({inbox:{},newsItems:[]}),TypeError);
  const r=auditInboxNewsOverlaps({inbox:[{...inboxItem,id:0}],newsItems:[{...newsItem,source_url:'javascript:alert(1)'}]});
  assert.equal(r.candidate_pair_count,0);
  assert.equal(r.ignored_inbox_rows,1);
  assert.equal(r.ignored_news_rows,1);
});

test('rejects superficially similar but not identical URLs', () => {
  const r=auditInboxNewsOverlaps({inbox:[inboxItem],newsItems:[{...newsItem,source_url:original+'#section'}]});
  assert.equal(r.candidate_pair_count,0);
});
