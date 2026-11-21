import assert from 'node:assert/strict';
import {test} from 'node:test';
import {auditCaseEvidenceCoverage} from '../scripts/audit-case-evidence-coverage.mjs';

const example=()=>({cases:[{id:1},{id:2}],sources:[{id:11,url:'https://example.org/?token=secret'}],
  masterSourceRegister:[{id:21,source_id:11}],caseSourceReferences:[{case_id:1,register_id:21}],
  claims:[{id:30,case_id:1}],claimSources:[{claim_id:30,source_id:11}]});

test('distinguishes case source links from structured claim links',()=>{
  const r=auditCaseEvidenceCoverage(example());
  assert.equal(r.cases_total,2);
  assert.equal(r.cases_with_registered_source_links,1);
  assert.deepEqual(r.cases_without_registered_source_link_ids,[2]);
  assert.deepEqual(r.cases_without_structured_claim_ids,[2]);
  assert.deepEqual(r.claims_without_source_link_ids,[]);
});

test('missing source links are not labeled unverified or disproven',()=>{
  const r=auditCaseEvidenceCoverage({cases:[{id:2}]});
  assert.deepEqual(r.cases_without_registered_source_link_ids,[2]);
  assert.match(r.caveat,/does NOT establish/);
});

test('orphan IDs are detected without guessing how to repair',()=>{
  const o=example();
  o.masterSourceRegister.push({id:22,source_id:999},{id:23,source_id:null});
  o.caseSourceReferences.push({case_id:999,register_id:21},{case_id:2,register_id:999});
  o.claims.push({id:31,case_id:999},{id:32,case_id:null});
  o.claimSources.push({claim_id:999,source_id:11},{claim_id:30,source_id:999});
  const r=auditCaseEvidenceCoverage(o);
  assert.deepEqual(r.orphan_case_link_ids,[999]);
  assert.deepEqual(r.orphan_register_link_ids,[999]);
  assert.deepEqual(r.orphan_source_register_ids,[22]);
  assert.deepEqual(r.register_rows_without_source_ids,[23]);
  assert.deepEqual(r.claims_without_valid_case_ids,[31,32]);
  assert.deepEqual(r.orphan_claim_link_ids,[999]);
  assert.deepEqual(r.orphan_claim_source_ids,[999]);
});

test('duplicate pairs are flagged but never automatically merged',()=>{
  const o=example();o.caseSourceReferences.push({...o.caseSourceReferences[0]});o.claimSources.push({...o.claimSources[0]});
  const r=auditCaseEvidenceCoverage(o);
  assert.deepEqual(r.duplicate_case_register_links,[{case_id:1,register_id:21}]);
  assert.deepEqual(r.duplicate_claim_source_links,[{claim_id:30,source_id:11}]);
});

test('rejects malformed IDs, duplicate PKs, large inputs and bad rows',()=>{
  assert.throws(()=>auditCaseEvidenceCoverage({cases:[{id:0}]}),TypeError);
  assert.throws(()=>auditCaseEvidenceCoverage({sources:[{id:1},{id:1}]}),TypeError);
  assert.throws(()=>auditCaseEvidenceCoverage({caseSourceReferences:[null]}),TypeError);
  assert.throws(()=>auditCaseEvidenceCoverage({claims:[{id:1,case_id:'1'}]}),TypeError);
  assert.throws(()=>auditCaseEvidenceCoverage({cases:{}}),TypeError);
  assert.throws(()=>auditCaseEvidenceCoverage({cases:Array(100001).fill({id:1})}),TypeError);
});

test('does not include source titles, URLs or other sensitive text',()=>{
  const o=example();o.cases[0].title='confidential case';o.claims[0].claim_text='private';
  const result=JSON.stringify(auditCaseEvidenceCoverage(o));
  assert.equal(result.includes('secret'),false);
  assert.equal(result.includes('confidential'),false);
  assert.equal(result.includes('private'),false);
});

test('does not mutate frozen input rows',()=>{
  const o=example();for(const key of Object.keys(o)){o[key].forEach(Object.freeze);Object.freeze(o[key]);}
  const r=auditCaseEvidenceCoverage(o);
  assert.equal(r.cases_total,2);
  assert.equal(o.cases.length,2);
});
