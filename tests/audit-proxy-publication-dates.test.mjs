import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditProxyPublicationDates } from '../scripts/audit-proxy-publication-dates.mjs';

test('separates Google News proxy missing-date concentration from other HTTP links', () => {
  const r = auditProxyPublicationDates({newsItems:[
    {id:1, source_url:'https://news.google.com/rss/articles/a', published_at:null},
    {id:2, source_url:'https://news.google.com/rss/articles/b', published_at:''},
    {id:3, source_url:'https://www.nasa.gov/news-release/test', published_at:'2026-11-19T00:00:00Z'},
    {id:4, source_url:'https://www.bbc.co.uk/news/a', published_at:null}
  ]});
  assert.equal(r.groups.google_news_proxy.missing_publication,2);
  assert.equal(r.groups.other_http_source.missing_publication,1);
  assert.equal(r.groups.other_http_source.supplied_publication,1);
  assert.equal(r.missing_publication_total,3);
});

test('never treats lookalike hostnames, embedded credentials, or unsupported protocols as trusted Google sources', () => {
  const r=auditProxyPublicationDates({newsItems:[
    {id:1,source_url:'https://news.google.com.evil.example/a',published_at:null},
    {id:2,source_url:'https://news.google.com@evil.example/a',published_at:null},
    {id:3,source_url:'file:///etc/passwd',published_at:null},
    {id:4,source_url:'https://user:pw@news.google.com/rss/a',published_at:null},
    {id:5,source_url:'not-a-url',published_at:null},
    {id:6,source_url:null,published_at:null}
  ]});
  assert.equal(r.groups.google_news_proxy.total,0);
  assert.equal(r.groups.other_http_source.total,1);
  assert.equal(r.groups.missing_or_unsafe_url.total,5);
});

test('cohort matching is hostname-based, not raw substring or case-specific', () => {
  const r=auditProxyPublicationDates({newsItems:[
    {id:1,source_url:'HTTPS://NEWS.GOOGLE.COM/rss/articles/x',published_at:null},
    {id:2,source_url:'https://example.org/news.google.com/',published_at:null}
  ]});
  assert.equal(r.groups.google_news_proxy.total,1);
  assert.equal(r.groups.other_http_source.total,1);
});

test('returns bounded IDs-only examples and never outputs secret URLs or user data', () => {
  const rows=Array.from({length:30},(_,i)=>({id:i+1, headline:'Sensitive title', source_url:'https://news.google.com/rss/a?private_secret='+i,published_at:null}));
  const result=auditProxyPublicationDates({newsItems:rows});
  assert.equal(result.groups.google_news_proxy.missing_sample_ids.length,20);
  assert.equal(JSON.stringify(result).includes('private_secret'),false);
  assert.equal(JSON.stringify(result).includes('Sensitive title'),false);
  assert.equal(rows[0].published_at,null);
});

test('ignores invalid and repeated IDs and does not incorrectly classify invalid dates as missing', () => {
  const r=auditProxyPublicationDates({newsItems:[
    {id:1,source_url:'https://news.google.com/a',published_at:'invalid'},
    {id:1,source_url:'https://news.google.com/b',published_at:null},
    {id:'secret',source_url:'https://news.google.com/c',published_at:null},
    null
  ]});
  assert.equal(r.valid_unique_ids,1);
  assert.equal(r.ignored_rows,3);
  assert.equal(r.groups.google_news_proxy.supplied_publication,1);
  assert.equal(r.groups.google_news_proxy.missing_publication,0);
});

test('rejects wrong shapes and oversize snapshots', () => {
  assert.throws(()=>auditProxyPublicationDates({newsItems:{}}),TypeError);
  assert.throws(()=>auditProxyPublicationDates({newsItems:new Array(100001)}),TypeError);
});
