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

test('counts distinct underlying sources independently from register references',()=>{
  const x=audit(sample());
  assert.equal(x.summary.references_total,3);
  assert.equal(x.summary.unique_case_source_pairs,3);
  assert.equal(x.summary.repeated_case_source_pairs,0);
  assert.equal(x.summary.underlying_sources_shared_across_cases,1);
  assert.equal(x.summary.published_cases_with_complete_marked_published_source,1);
  assert.equal(x.summary.published_cases_without_complete_marked_published_source,1);
});
test('flags two register IDs to the same underlying source without deleting either',()=>{
  const s=sample();
  s.master_source_register.push({id:102,source_id:11});
  s.case_source_references.push({case_id:1,register_id:102});
  s.expected_counts.master_source_register++;
  s.expected_counts.case_source_references++;
  const x=audit(s);
  assert.equal(x.summary.references_total,4);
  assert.equal(x.summary.unique_case_source_pairs,3);
  assert.equal(x.summary.repeated_case_source_pairs,1);
  assert.equal(x.summary.excess_register_references_to_same_source,1);
  assert.deepEqual(x.repeated_underlying_source_pairs,[{case_id:1,source_id:11,register_ids:[101,102]}]);
  assert.ok(x.flagged_cases.find(c=>c.case_id===1).reasons.includes('repeated_underlying_source'));
});
test('two incomplete published sources cannot combine metadata to appear complete',()=>{
  const s=sample();
  s.sources[0].publisher=null;
  s.sources[1].published=true;
  s.sources[1].publisher='Public Agency';
  const x=audit(s);
  assert.equal(x.summary.published_cases_with_complete_marked_published_source,0);
  assert.equal(x.summary.published_cases_without_complete_marked_published_source,2);
  const first=x.flagged_cases.find(c=>c.case_id===1).reasons;
  assert.ok(!first.includes('no_dated_source'));
  assert.ok(!first.includes('no_attributed_publisher'));
  assert.ok(first.includes('no_single_complete_marked_published_source'));
});
test('shared source among cases is one source, not independent corroboration',()=>{
  const s=sample();
  s.case_source_references.push({case_id:3,register_id:101});
  s.expected_counts.case_source_references++;
  const x=audit(s);
  assert.equal(x.summary.underlying_sources_shared_across_cases,1);
  assert.equal(x.summary.unique_referenced_sources,2);
  assert.equal(x.summary.unique_case_source_pairs,4);
  assert.equal(x.summary.published_cases,2);
});

test('non-web source URLs cannot satisfy complete provenance',()=>{
  const s=sample();
  s.sources[0].url='javascript:alert(1)';
  const x=audit(s);
  assert.equal(x.summary.references_to_invalid_source_url,1);
  assert.equal(x.summary.published_cases_with_complete_marked_published_source,0);
  assert.ok(x.flagged_cases.find(c=>c.case_id===1).reasons.includes('no_single_complete_marked_published_source'));
});
test('embedded URL credentials are flagged rather than exposed in output',()=>{
  const s=sample();
  s.sources[0].url='https://researcher:secret@agency.gov/report';
  const x=audit(s);
  assert.equal(x.summary.references_to_invalid_source_url,1);
  assert.equal(JSON.stringify(x).includes('secret'),false);
});
test('whitespace in URL is flagged even if URL parser could encode it',()=>{
  const s=sample();
  s.sources[0].url='https://agency.gov/a b';
  assert.equal(audit(s).summary.references_to_invalid_source_url,1);
});
test('missing and syntactically invalid URLs have separate review reasons',()=>{
  const s=sample();
  s.sources[0].url='mailto:records@agency.gov';
  s.sources[1].url=null;
  const x=audit(s);
  assert.equal(x.summary.references_to_invalid_source_url,1);
  assert.equal(x.summary.references_to_missing_source_url,2);
  assert.equal(x.summary.published_cases_without_valid_source_url,2);
  assert.ok(x.flagged_cases.find(c=>c.case_id===2).reasons.includes('no_valid_source_url'));
});
test('ordinary HTTPS query strings and fragments remain valid',()=>{
  const s=sample();
  s.sources[0].url='https://agency.gov:443/report?item=1#section';
  const x=audit(s);
  assert.equal(x.summary.references_to_invalid_source_url,0);
  assert.equal(x.summary.published_cases_with_complete_marked_published_source,1);
});


test('distinguishes bibliography-only cases from independently cataloged source types',()=>{
  const s=sample();
  s.sources[0].source_type='Congressional Hearing';
  s.sources[1].source_type='master_index_bibliography';
  s.case_source_references.forEach(r=>r.source_role='cited_by_master_index');
  const x=audit(s);
  assert.equal(x.summary.references_with_master_index_role,3);
  assert.equal(x.summary.references_to_master_index_bibliography,2);
  assert.equal(x.summary.published_cases_with_only_master_index_bibliography_sources,1);
  assert.ok(x.flagged_cases.find(c=>c.case_id===2).reasons.includes('only_master_index_bibliography_sources'));
  assert.ok(!x.flagged_cases.find(c=>c.case_id===1).reasons.includes('only_master_index_bibliography_sources'));
  assert.ok(x.flagged_cases.find(c=>c.case_id===1).reasons.includes('only_master_index_citation_roles'));
});

test('a mix of bibliography and non-bibliography source is not bibliography-only',()=>{
  const s=sample();
  s.sources[0].source_type='official investigation announcement';
  s.sources[1].source_type='master_index_bibliography';
  const x=audit(s);
  assert.equal(x.summary.published_cases_with_only_master_index_bibliography_sources,1);
  assert.equal(x.flagged_cases.some(c=>c.case_id===1),false);
});

test('no source links are a separate reason, not bibliography-only',()=>{
  const s=sample();s.case_source_references=[];
  s.expected_counts.case_source_references=0;
  const x=audit(s);
  assert.equal(x.summary.published_cases_with_only_master_index_bibliography_sources,0);
  assert.equal(x.summary.published_cases_without_references,2);
  assert.ok(x.flagged_cases.every(c=>!c.reasons.includes('only_master_index_bibliography_sources')));
});

test('a published bibliography record still needs its original document checked',()=>{
  const s=sample();
  s.sources[0].source_type='master_index_bibliography';
  s.sources[1].source_type='master_index_bibliography';
  const x=audit(s);
  assert.equal(x.summary.published_cases_with_only_master_index_bibliography_sources,2);
  assert.ok(x.flagged_cases.find(c=>c.case_id===1).reasons.includes('only_master_index_bibliography_sources'));
});

test('non-string source type is rejected as an invalid snapshot',()=>{
  const s=sample();s.sources[0].source_type={unexpected:'value'};
  assert.throws(()=>audit(s),/Invalid source/);
});


test('all index citation roles flag a published case even if source type is official',()=>{
  const s=sample();
  s.sources[0].source_type='Congressional Hearing';
  s.case_source_references.forEach(r=>r.source_role='cited_by_master_index');
  const x=audit(s);
  assert.equal(x.summary.published_cases_with_only_master_index_citation_roles,2);
  assert.equal(x.summary.references_without_explicit_source_role,0);
  assert.ok(x.flagged_cases.find(c=>c.case_id===1).reasons.includes('only_master_index_citation_roles'));
});

test('a non-index link role prevents index-only categorization without proving authenticity',()=>{
  const s=sample();
  s.case_source_references.forEach(r=>r.source_role='cited_by_master_index');
  s.case_source_references[0].source_role='direct_document_link';
  const x=audit(s);
  assert.equal(x.summary.published_cases_with_only_master_index_citation_roles,1);
  assert.ok(!x.flagged_cases.some(c=>c.case_id===1));
  assert.ok(x.flagged_cases.find(c=>c.case_id===2).reasons.includes('only_master_index_citation_roles'));
});

test('missing citation roles are unknown, not assumed to be master-index roles',()=>{
  const x=audit(sample());
  assert.equal(x.summary.references_without_explicit_source_role,3);
  assert.equal(x.summary.published_cases_with_only_master_index_citation_roles,0);
});

test('invalid non-string citation role is rejected',()=>{
  const s=sample();s.case_source_references[0].source_role={untrusted:'value'};
  assert.throws(()=>audit(s),/Invalid case source reference/);
});

test('separates library source visibility from case-register linkage',()=>{
  const s=sample();
  s.sources.push({id:12,published:true,publisher:'Agency',publication_date:null,
    url:'https://agency.gov/unlinked',title:'PRIVATE LIBRARY SOURCE'});
  s.expected_counts.sources++;
  const x=audit(s);
  assert.equal(x.summary.library_sources_marked_published,2);
  assert.equal(x.summary.library_sources_marked_published_outside_case_register,1);
  assert.equal(x.summary.outside_register_marked_published_sources_undated,1);
  assert.deepEqual(x.marked_published_source_ids_outside_case_register,[12]);
  assert.equal(x.omitted_outside_case_register_sources,0);
  assert.ok(!JSON.stringify(x).includes('PRIVATE LIBRARY SOURCE'));
});
test('draft-case register citation counts as linked, without requiring publication',()=>{
  const s=sample();
  s.case_source_references.push({case_id:3,register_id:100});
  s.expected_counts.case_source_references++;
  const x=audit(s);
  assert.equal(x.summary.library_sources_marked_published_outside_case_register,0);
});
test('unlinked published-source list is capped, while counts remain complete',()=>{
  const s=sample();
  for (let i=0;i<28;i++) s.sources.push({id:100+i,published:true,url:'https://example.gov/'+i,publication_date:null});
  s.expected_counts.sources=s.sources.length;
  const x=audit(s);
  assert.equal(x.summary.library_sources_marked_published_outside_case_register,28);
  assert.equal(x.summary.outside_register_marked_published_sources_undated,28);
  assert.deepEqual(x.marked_published_source_ids_outside_case_register,[...Array(25)].map((_,i)=>100+i));
  assert.equal(x.omitted_outside_case_register_sources,3);
});

test('graph linkage is explicitly unassessed when no complete graph snapshot is provided',()=>{
  const x=audit(sample());
  assert.equal(x.relationship_graph,null);
});
test('incomplete optional relationship graph fails instead of reporting zero links',()=>{
  const s=sample();s.relationships=[{id:1,source_type:'case',target_type:'source',source_id:2,target_id:10,source_id_reference:10}];
  s.expected_counts.relationships=2;
  assert.throws(()=>audit(s),/Incomplete relationship graph snapshot/);
});
test('complete graph reveals sourced cases missed by register-only assessment',()=>{
  const s=sample();
  s.relationships=[{id:1,source_type:'case',target_type:'source',source_id:2,target_id:10,source_id_reference:10}];
  s.expected_counts.relationships=1;
  const x=audit(s);
  assert.equal(x.summary.published_cases_with_complete_marked_published_source,1);
  assert.equal(x.relationship_graph.published_cases_with_graph_links,1);
  assert.equal(x.relationship_graph.published_cases_with_complete_marked_published_graph_source,1);
  assert.equal(x.relationship_graph.published_cases_with_complete_marked_published_source_either_path,2);
  assert.equal(x.relationship_graph.register_graph_pair_overlaps,0);
});
test('graph/register overlap is counted without double counting source relationships',()=>{
  const s=sample();
  s.relationships=[{id:1,source_type:'case',target_type:'source',source_id:1,target_id:10,source_id_reference:10},
    {id:2,source_type:'case',target_type:'source',source_id:1,target_id:10,source_id_reference:11}];
  s.expected_counts.relationships=2;
  const x=audit(s).relationship_graph;
  assert.equal(x.case_to_source_edges,2);
  assert.equal(x.unique_case_source_pairs,1);
  assert.equal(x.repeated_case_source_graph_edges,1);
  assert.equal(x.register_graph_pair_overlaps,1);
  assert.equal(x.target_reference_disagreements,1);
});
test('graph output never exposes source text or URLs',()=>{
  const s=sample();
  s.relationships=[{id:1,source_type:'case',target_type:'source',source_id:2,target_id:10,source_id_reference:10,notes:'SECRET REVIEW NOTE'}];
  s.expected_counts.relationships=1;
  const output=JSON.stringify(audit(s));
  assert.ok(!output.includes('SECRET REVIEW NOTE'));
  assert.ok(!output.includes('https://'));
});
