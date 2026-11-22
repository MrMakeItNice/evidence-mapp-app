import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCaseSourceCoverage } from '../scripts/audit-case-source-coverage.mjs';

function sample() {
  const cases=[{id:1,case_number:1,published:true,title:'PRIVATE CASE TITLE'},
    {id:2,case_number:2,published:true},
    {id:3,case_number:3,published:false}];
  const sources=[
    {id:10,published:true,publisher:'Public Agency',publication_date:'2026-11-20',url:'https://agency.gov/report',title:'SECRET TEXT'},
    {id:11,published:false,publisher:null,publication_date:null,url:'https://agency.gov/placeholder',notes:'PRIVATE'}
  ];
  const master_source_register=[{id:100,source_id:10},{id:101,source_id:11}];
  const case_source_references=[{case_id:1,register_id:100},{case_id:1,register_id:101},{case_id:2,register_id:101}];
  return {expected_counts:{cases:3,sources:2,master_source_register:2,case_source_references:3},
    cases,sources,master_source_register,case_source_references};
}
const audit=s=>auditCaseSourceCoverage(s);
test('counts published-case coverage separately from reference presence',()=>{
  const x=audit(sample());
  assert.equal(x.summary.published_cases,2);
  assert.equal(x.summary.published_cases_with_references,2);
  assert.equal(x.summary.published_cases_without_marked_published_source,1);
  assert.equal(x.summary.references_to_not_marked_published,2);
  assert.equal(x.summary.unique_referenced_sources_not_marked_published,1);
  assert.deepEqual(x.flagged_cases.map(c=>c.case_number),[2]);
});
test('published case with no references is identified',()=>{
  const s=sample();s.case_source_references=s.case_source_references.filter(r=>r.case_id!==2);
  s.expected_counts.case_source_references=2;
  const x=audit(s);
  assert.equal(x.summary.published_cases_without_references,1);
  assert.ok(x.flagged_cases.find(c=>c.case_number===2).reasons.includes('no_source_reference'));
});
test('draft case without links is not treated as a published coverage failure',()=>{
  assert.equal(audit(sample()).flagged_cases.some(c=>c.case_number===3),false);
});
test('missing metadata is measured separately from source visibility',()=>{
  const s=sample();s.sources[0].published=false;
  const x=audit(s);
  assert.equal(x.summary.published_cases_without_marked_published_source,2);
  assert.equal(x.summary.published_cases_without_dated_source,1);
  assert.equal(x.summary.references_to_unattributed_sources,2);
});
test('incomplete snapshot is rejected rather than estimating coverage',()=>{
  const s=sample();s.expected_counts.sources=3;
  assert.throws(()=>audit(s),/Incomplete snapshot/);
});
test('duplicate source IDs are rejected',()=>{
  const s=sample();s.sources[1].id=10;
  assert.throws(()=>audit(s),/Invalid source/);
});
test('duplicate case-register links are rejected',()=>{
  const s=sample();s.case_source_references.push({...s.case_source_references[0]});
  s.expected_counts.case_source_references=4;
  assert.throws(()=>audit(s),/Invalid case source reference/);
});
test('missing register or source links are rejected',()=>{
  const s=sample();s.master_source_register[0].source_id=99;
  assert.throws(()=>audit(s),/Invalid register/);
});
test('invalid calendar source dates are rejected',()=>{
  const s=sample();s.sources[0].publication_date='2026-02-30';
  assert.throws(()=>audit(s),/Invalid source date/);
});
test('output contains only IDs and coded review reasons, not source contents',()=>{
  const output=JSON.stringify(audit(sample()));
  assert.ok(!output.includes('PRIVATE CASE TITLE'));
  assert.ok(!output.includes('SECRET TEXT'));
  assert.ok(!output.includes('https://'));
});
test('unexpected missing source URLs are counted, not silently ignored',()=>{
  const s=sample();s.sources[1].url=null;
  assert.equal(audit(s).summary.references_to_missing_source_url,2);
});
test('caps case-ID output while preserving aggregate totals',()=>{
  const s=sample();
  s.cases=[];s.sources=[s.sources[1]];s.master_source_register=[{id:101,source_id:11}];
  s.case_source_references=[];
  for(let n=1;n<=55;n++){s.cases.push({id:n,case_number:n,published:true});s.case_source_references.push({case_id:n,register_id:101})}
  s.expected_counts={cases:55,sources:1,master_source_register:1,case_source_references:55};
  const x=audit(s);
  assert.equal(x.flagged_case_count,55);
  assert.equal(x.flagged_cases.length,50);
  assert.equal(x.omitted_flagged_cases,5);
});
