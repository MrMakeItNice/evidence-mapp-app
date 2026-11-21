import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSourceNewsLinks } from '../scripts/audit-source-news-links.mjs';

const s = (id,url,other={}) => ({ id, url, ...other });
const n = (id,source_url,other={}) => ({ id, source_url, ...other });

test('exact URL match gives IDs and comparisons, no source text or URLs', () => {
  const out = auditSourceNewsLinks({
    sources:[s(8,'https://example.org/paper?version=1',{ publisher:'World Health Organization',publication_date:null,title:'secret title' })],
    newsItems:[n(10,'https://example.org/paper?version=1',{publisher:'  world health  organization ',published_at:'2025-06-27T10:00:00Z',headline:'secret news'})],
  });
  assert.equal(out.candidate_pair_count,1);
  assert.deepEqual(out.candidates[0],{
    source_id:8,news_id:10,publisher_comparison:'same',
    publication_day_comparison:'one_missing_or_invalid',review_status:'human_review_required'
  });
  assert.doesNotMatch(JSON.stringify(out),/secret|example.org|2025-06-27|World Health/);
});
test('functional query, fragment, protocol and case are preserved',()=>{
  const out=auditSourceNewsLinks({sources:[s(1,'https://court.test/case?id=123#A')],
    newsItems:[n(2,'https://court.test/case?id=456#A'),n(3,'https://court.test/case?id=123#B'),n(4,'http://court.test/case?id=123#A'),n(5,'https://court.test/case?id=123#a')]});
  assert.equal(out.candidate_pair_count,0);
});
test('only whitespace outside URL is ignored',()=>{
  const out=auditSourceNewsLinks({sources:[s(3,' https://site.test/doc?id=1 ')],newsItems:[n(8,'https://site.test/doc?id=1')]});
  assert.deepEqual(out.candidates.map(v=>[v.source_id,v.news_id]),[[3,8]]);
});
test('secret query parameters and URL credentials are excluded',()=>{
  const urls=['https://ex.test/?TOKEN=anything','https://alice:pass@ex.test/a','file:///etc/passwd'];
  const out=auditSourceNewsLinks({sources:urls.map((v,i)=>s(i+1,v)),newsItems:urls.map((v,i)=>n(i+4,v))});
  assert.equal(out.candidate_pair_count,0);
  assert.equal(out.ignored_source_urls,3);
  assert.equal(out.ignored_news_urls,3);
});
test('ambiguous groups get IDs only, never arbitrarily paired',()=>{
  const out=auditSourceNewsLinks({sources:[s(8,'https://a.test/x'),s(7,'https://a.test/x')],newsItems:[n(5,'https://a.test/x')]});
  assert.equal(out.candidate_pair_count,0);
  assert.deepEqual(out.ambiguous_url_groups,[{source_ids:[7,8],news_ids:[5]}]);
});
test('invalid/missing and conflicting dates are not silently filled',()=>{
  const out=auditSourceNewsLinks({sources:[s(1,'https://a.test/1',{publication_date:'2025-02-30'}),s(2,'https://a.test/2',{publication_date:'2025-02-28'})],newsItems:[n(11,'https://a.test/1',{published_at:'not a date'}),n(12,'https://a.test/2',{published_at:'2025-03-01T12:00:00Z'})]});
  assert.deepEqual(out.candidates.map(v=>v.publication_day_comparison),['both_missing_or_invalid','different']);
});
test('invalid input and duplicate ids rejected',()=>{
  assert.throws(()=>auditSourceNewsLinks({sources:'bad'}),TypeError);
  assert.throws(()=>auditSourceNewsLinks({sources:[s(1,'https://a.test'),s(1,'https://b.test')]}),TypeError);
  assert.throws(()=>auditSourceNewsLinks({newsItems:[{id:-2,source_url:'https://a.test'}]}),TypeError);
});
test('source input stays unchanged',()=>{
  const sources=Object.freeze([Object.freeze(s(2,'https://a.test/x',{publication_date:null}))]);
  const newsItems=Object.freeze([Object.freeze(n(3,'https://a.test/x',{published_at:'2026-11-21'}))]);
  auditSourceNewsLinks({sources,newsItems});
  assert.equal(sources[0].publication_date,null);
  assert.equal(newsItems[0].published_at,'2026-11-21');
});
