import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suggestReportIdLinks } from '../scripts/suggest-report-id-links.mjs';

test('links three collections only as candidates when GAO ID is unique in each', () => {
  const out=suggestReportIdLinks({
    newsItems:[{id:1,headline:'Oversight of GAO-27-109420',source_url:'https://www.example.org/report'}],
    sources:[{id:5,title:'DOD Munitions',url:'https://www.gao.gov/products/gao-27-109420'}],
    researchInbox:[{id:9,title:'Review GAO-27-109420'}]
  });
  assert.equal(out.matched_report_count,1);
  assert.equal(out.pair_candidate_count,3);
  assert.deepEqual(out.sample_candidates.map(x=>x.report_id),Array(3).fill('GAO-27-109420'));
});

test('official reports path is recognized; off-domain path and insecure URL are not', () => {
  const out=suggestReportIdLinks({sources:[
    {id:1,url:'https://files.gao.gov/reports/GAO-27-108744/index.html'},
    {id:2,url:'https://attacker.example/reports/GAO-27-108744'},
    {id:3,url:'http://www.gao.gov/products/gao-27-108744'},
  ],newsItems:[{id:10,headline:'GAO-27-108744'}]});
  assert.equal(out.pair_candidate_count,1);
  assert.deepEqual(out.sample_candidates[0].left,{id:10,collection:'news',evidence:'title_mention'});
});

test('multiple IDs in a row are conflict, not strong evidence', () => {
  const out=suggestReportIdLinks({sources:[{id:3,title:'GAO-27-108744 comparison to GAO-27-108087'}],newsItems:[{id:4,headline:'GAO-27-108744'}]});
  assert.equal(out.pair_candidate_count,0);
  assert.equal(out.conflicting_identifier_rows,1);
});

test('duplicate report records inside one collection are ambiguous, never auto paired', () => {
  const out=suggestReportIdLinks({sources:[{id:1,title:'GAO-27-108744'},{id:2,title:'GAO-27-108744'}],newsItems:[{id:3,headline:'GAO-27-108744'}]});
  assert.equal(out.pair_candidate_count,0);
  assert.deepEqual(out.ambiguous_report_ids,['GAO-27-108744']);
});

test('malicious URLs, titles and query secrets are never reproduced', () => {
  const secret='topsecret-token';
  const out=suggestReportIdLinks({sources:[{id:1,title:'GAO-27-108744',url:'https://www.gao.gov/products/gao-27-108744?token='+secret}],newsItems:[{id:2,headline:'GAO-27-108744',source_url:'https://'+secret+'@www.gao.gov/products/gao-27-108744'}]});
  assert.equal(out.pair_candidate_count,1);
  assert.ok(!JSON.stringify(out).includes(secret));
});

test('string IDs, invalid data and large arrays are rejected or ignored safely', () => {
  assert.throws(()=>suggestReportIdLinks({newsItems:{}}),TypeError);
  const out=suggestReportIdLinks({newsItems:[{id:'1',headline:'GAO-27-108744'},null],sources:[{id:2,title:'GAO-27-108744'}]});
  assert.equal(out.ignored_rows,2);
  assert.equal(out.pair_candidate_count,0);
});

test('non-GAO identifiers and malformed report numbers do not collide', () => {
  const out=suggestReportIdLinks({newsItems:[{id:1,headline:'GAO-27-10874 and GAO-27-1087440 and B-338895'}],sources:[{id:2,title:'GAO-27-108744'}]});
  assert.equal(out.pair_candidate_count,0);
});
