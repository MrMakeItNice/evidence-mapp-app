import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewSourceReferenceCoverage, SOURCE_REFERENCE_FIELDS } from '../scripts/review-source-reference-coverage.mjs';
const empty = () => Object.fromEntries(Object.keys(SOURCE_REFERENCE_FIELDS).map(key => [key, []]));

test('all nine source reference families are required to avoid false orphan reports', () => {
  assert.throws(() => reviewSourceReferenceCoverage({sources:[{id:1}], references:{master_source_register:[]}}), /family set/);
  assert.throws(() => reviewSourceReferenceCoverage({sources:[], references:{...empty(), evil:[]}}), /family set/);
});

test('a relationship citation counts as a link even without master register membership', () => {
  const refs = empty(); refs.relationships = [{source_id_reference:2}];
  const result = reviewSourceReferenceCoverage({sources:[{id:1,published:true},{id:2,published:true}],references:refs});
  assert.equal(result.linked_sources, 1);
  assert.deepEqual(result.unlinked_source_ids, [1]);
  assert.deepEqual(result.published_unlinked_source_ids,[1]);
  assert.equal(result.distinct_sources_by_family.relationships,1);
});

test('deduplicates repeated citations across and within reference families', () => {
  const refs=empty(); refs.master_source_register=[{source_id:9},{source_id:9}]; refs.claim_sources=[{source_id:9}];
  const result=reviewSourceReferenceCoverage({sources:[{id:9}],references:refs});
  assert.equal(result.linked_sources,1); assert.deepEqual(result.unlinked_source_ids,[]);
  assert.equal(result.distinct_sources_by_family.master_source_register,1);
});

test('ignores null references and flags references to missing IDs for human review', () => {
  const refs=empty(); refs.relationships=[{source_id_reference:null},{source_id_reference:888}];
  const result=reviewSourceReferenceCoverage({sources:[{id:1,published:false}],references:refs});
  assert.equal(result.null_reference_counts.relationships,1);
  assert.deepEqual(result.unknown_reference_source_ids,[888]);
  assert.deepEqual(result.published_unlinked_source_ids,[]);
});

test('rejects invalid and repeated IDs', () => {
  assert.throws(() => reviewSourceReferenceCoverage({sources:[{id:1},{id:1}],references:empty()}), /duplicate/);
  const refs=empty(); refs.claim_sources=[{source_id:'1'}];
  assert.throws(() => reviewSourceReferenceCoverage({sources:[{id:1}],references:refs}),/Invalid source reference/);
});

test('does not emit URLs, titles, contents or tokens and does not alter snapshot', () => {
  const refs=empty(); refs.relationships=[{source_id_reference:8,notes:'private-token-123'}];
  const input={sources:[{id:8,published:true,url:'https://example.test/?token=private-token-123',title:'sensitive title'}],references:refs};
  const before=JSON.stringify(input);
  const output=JSON.stringify(reviewSourceReferenceCoverage(input));
  assert.equal(JSON.stringify(input),before);
  assert.doesNotMatch(output,/private-token|sensitive title|example\.test|notes/);
});
