import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewHeadlineCollisions } from '../scripts/review-headline-collisions.mjs';
const base = 'Government oversight committee releases detailed public records report on procurement practices';

test('detects long repeated headlines ignoring Unicode punctuation and casing', () => {
  const result = reviewHeadlineCollisions([
    {id: 1, headline: base},
    {id: 2, headline: 'GOVERNMENT oversight committee releases detailed public records report on procurement practices!'},
  ]);
  assert.deepEqual(result.candidate_groups, [{ids:[1,2],match_reason:'same_normalized_headline_only',review_status:'human_review_required'}]);
});

test('does not confuse short generic headings with article duplicates', () => {
  const result = reviewHeadlineCollisions([{id:1,headline:'Inside Health'},{id:2,headline:'INSIDE HEALTH'}]);
  assert.equal(result.candidate_groups.length,0);
  assert.equal(result.ignored_short_titles,2);
});

test('rejects invalid IDs, redacts article text and does not mutate input', () => {
  const rows = Object.freeze([
    Object.freeze({id:'a_1',headline:base,source_url:'https://example.org?access_token=secret'}),
    Object.freeze({id:'a_2',headline:base,summary:'PRIVATE NOTES'}) ,
    Object.freeze({id:'bad id',headline:base})
  ]);
  const report = reviewHeadlineCollisions(rows);
  assert.equal(report.ignored_invalid_rows,1);
  assert.deepEqual(report.candidate_groups[0].ids,['a_1','a_2']);
  assert.equal(JSON.stringify(report).includes('secret'),false);
  assert.equal(JSON.stringify(report).includes('PRIVATE NOTES'),false);
  assert.equal(rows[0].headline,base);
});

test('handles duplicate input ID once rather than fabricating extra collision', () => {
  const r = reviewHeadlineCollisions([{id:12,headline:base},{id:12,headline:base}]);
  assert.deepEqual(r.candidate_groups,[]);
});

test('conservatively distinguishes substantive headline changes', () => {
  const r = reviewHeadlineCollisions([
    {id:1,headline:base},
    {id:2,headline:base.replace('procurement','treatment')}
  ]);
  assert.equal(r.candidate_groups.length,0);
});

test('requires an array', () => {
  assert.throws(() => reviewHeadlineCollisions({records:[]}),TypeError);
});
