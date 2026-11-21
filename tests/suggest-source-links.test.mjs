import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suggestSourceLinks } from '../scripts/suggest-source-links.mjs';

const title='Winter Hits Gaza Hard as Food and Shelter Aid Runs Short, IOM and WFP Warn';

test('suggests known publisher-suffixed Google News item for editorial review', () => {
  const news=[{id:17683,headline:title+' - International Organization for Migration',
    publisher:'International Organization for Migration (via Google News)',source_url:'https://news.google.com/rss/articles/secret'}];
  const sources=[{id:'WFP-Nov17',title,url:'https://www.wfp.org/news/winter-hits-gaza-hard-food-and-shelter-aid-runs-short-iom-and-wfp-warn'}];
  assert.deepEqual(suggestSourceLinks(news,sources), [{news_id:17683,curated_source_id:'WFP-Nov17',match_reason:'publisher_suffix_title',status:'human_review_required'}]);
  assert.equal(JSON.stringify(suggestSourceLinks(news,sources)).includes('http'),false);
});

test('requires publisher agreement before stripping a trailing news suffix', () => {
  const news=[{id:1,headline:title+' - Unrelated Outlet',publisher:'International Organization for Migration'}];
  assert.deepEqual(suggestSourceLinks(news,[{id:2,title}]),[]);
});

test('supports exact title match without removing significant document identifiers', () => {
  const src='Government Accountability Office Performance and Accountability Report Fiscal Year 2026 GAO-27-900726';
  assert.deepEqual(suggestSourceLinks([{id:4,headline:src}],[{id:5,title:src}]),[{news_id:4,curated_source_id:5,match_reason:'exact_title',status:'human_review_required'}]);
  assert.deepEqual(suggestSourceLinks([{id:4,headline:src.replace('900726','900725')}],[{id:5,title:src}]),[]);
});

test('rejects ambiguous or short titles and never modifies provided rows', () => {
  const news=Object.freeze([{id:1,headline:title,publisher:'WFP'}]);
  const sources=Object.freeze([{id:8,title},{id:9,title},{id:10,title:'Short headline'}]);
  assert.deepEqual(suggestSourceLinks(news,sources),[]);
  assert.deepEqual(suggestSourceLinks([{id:1,headline:'Short headline'}],sources),[]);
});

test('rejects invalid inputs', () => {
  assert.throws(()=>suggestSourceLinks({},[]),TypeError);
  assert.deepEqual(suggestSourceLinks([{id:'not safe!',headline:title}],[{id:2,title}]),[]);
});
