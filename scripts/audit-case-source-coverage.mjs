// Review-only offline diagnostic. No network, Supabase client, credentials or data mutation.
// Usage: node scripts/audit-case-source-coverage.mjs complete-local-snapshot.json
// Snapshot includes complete cases, sources, master_source_register, case_source_references
// and expected_counts for each. NEVER commit a snapshot with unpublished research.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const tables = ['cases', 'sources', 'master_source_register', 'case_source_references'];
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const id = v => Number.isSafeInteger(v) && v > 0;
const missing = v => v == null || (typeof v === 'string' && !v.trim());
const key = (a,b) => a + ':' + b;

function datePresent(v) {
  if (missing(v)) return false;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Invalid source date');
  const [y,m,d] = v.split('-').map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31,30,31,30,31,31,30,31,30,31];
  if (y === 0 || m < 1 || m > 12 || d < 1 || d > days[m-1]) throw new Error('Invalid source date');
  return true;
}
function uniqueMap(rows, field, name, validator) {
  const out = new Map();
  for (const row of rows) {
    if (!object(row) || !id(row[field]) || out.has(row[field]) || !validator(row)) {
      throw new Error('Invalid ' + name);
    }
    out.set(row[field], row);
  }
  return out;
}
export function auditCaseSourceCoverage(snapshot) {
  if (!object(snapshot) || !object(snapshot.expected_counts)) throw new Error('Invalid snapshot');
  for (const name of tables) {
    if (!Array.isArray(snapshot[name]) ||
        !Number.isSafeInteger(snapshot.expected_counts[name]) ||
        snapshot.expected_counts[name] < 0 ||
        snapshot[name].length !== snapshot.expected_counts[name]) {
      throw new Error('Incomplete snapshot');
    }
  }
  const cases = uniqueMap(snapshot.cases, 'id', 'case', c =>
    id(c.case_number) && typeof c.published === 'boolean');
  const sources = uniqueMap(snapshot.sources, 'id', 'source', s =>
    (s.published == null || typeof s.published === 'boolean') &&
    (missing(s.publisher) || typeof s.publisher === 'string') &&
    (missing(s.url) || typeof s.url === 'string') && (datePresent(s.publication_date), true));
  const register = uniqueMap(snapshot.master_source_register, 'id', 'register', r =>
    id(r.source_id) && sources.has(r.source_id));
  const links = new Map([...cases.keys()].map(c => [c, []]));
  const pairs = new Set();
  // Different master-register IDs may point to the same underlying source.
  // Count both catalog references and distinct case/source relationships.
  const sourcePairs = new Map();
  const sourceCases = new Map();
  for (const r of snapshot.case_source_references) {
    if (!object(r) || !id(r.case_id) || !id(r.register_id) ||
        !cases.has(r.case_id) || !register.has(r.register_id) ||
        pairs.has(key(r.case_id,r.register_id))) throw new Error('Invalid case source reference');
    pairs.add(key(r.case_id,r.register_id));
    const sourceId = register.get(r.register_id).source_id;
    const sourcePair = key(r.case_id,sourceId);
    if (!sourcePairs.has(sourcePair)) sourcePairs.set(sourcePair,{case_id:r.case_id,source_id:sourceId,register_ids:[]});
    sourcePairs.get(sourcePair).register_ids.push(r.register_id);
    if (!sourceCases.has(sourceId)) sourceCases.set(sourceId,new Set());
    sourceCases.get(sourceId).add(r.case_id);
    links.get(r.case_id).push(sources.get(sourceId));
  }
  const summary = {
    cases_total: cases.size,
    published_cases: 0,
    published_cases_with_references: 0,
    published_cases_without_references: 0,
    published_cases_without_marked_published_source: 0,
    published_cases_without_dated_source: 0,
    published_cases_without_attributed_publisher: 0,
    references_total: pairs.size,
    unique_case_source_pairs: sourcePairs.size,
    repeated_case_source_pairs: 0,
    excess_register_references_to_same_source: 0,
    underlying_sources_shared_across_cases: 0,
    published_cases_with_complete_marked_published_source: 0,
    published_cases_without_complete_marked_published_source: 0,
    references_to_not_marked_published: 0,
    references_to_undated_sources: 0,
    references_to_unattributed_sources: 0,
    references_to_missing_source_url: 0,
    unique_referenced_sources: 0,
    unique_referenced_sources_not_marked_published: 0
  };
  const repeated = [...sourcePairs.values()].filter(x=>x.register_ids.length>1)
    .sort((a,b)=>a.case_id-b.case_id || a.source_id-b.source_id);
  summary.repeated_case_source_pairs = repeated.length;
  summary.excess_register_references_to_same_source =
    repeated.reduce((n,p)=>n+p.register_ids.length-1,0);
  summary.underlying_sources_shared_across_cases =
    [...sourceCases.values()].filter(caseIds=>caseIds.size>1).length;
  const repeatedCases = new Set(repeated.map(x=>x.case_id));
  const used = new Set();
  const flagged = [];
  for (const c of cases.values()) {
    const refs = links.get(c.id);
    for (const s of refs) {
      used.add(s.id);
      if (s.published !== true) summary.references_to_not_marked_published++;
      if (!datePresent(s.publication_date)) summary.references_to_undated_sources++;
      if (missing(s.publisher)) summary.references_to_unattributed_sources++;
      if (missing(s.url)) summary.references_to_missing_source_url++;
    }
    if (!c.published) continue;
    summary.published_cases++;
    if (refs.length) summary.published_cases_with_references++;
    else summary.published_cases_without_references++;
    const reasons = [];
    if (!refs.length) reasons.push('no_source_reference');
    if (!refs.some(s => s.published === true)) {
      summary.published_cases_without_marked_published_source++;
      reasons.push('no_source_marked_published');
    }
    if (!refs.some(s => datePresent(s.publication_date))) {
      summary.published_cases_without_dated_source++;
      reasons.push('no_dated_source');
    }
    if (!refs.some(s => !missing(s.publisher))) {
      summary.published_cases_without_attributed_publisher++;
      reasons.push('no_attributed_publisher');
    }
    // Metadata must coexist on ONE linked record, not across unrelated sources.
    if (refs.some(s => s.published === true && !missing(s.publisher) &&
                       datePresent(s.publication_date) && !missing(s.url))) {
      summary.published_cases_with_complete_marked_published_source++;
    } else {
      summary.published_cases_without_complete_marked_published_source++;
      reasons.push('no_single_complete_marked_published_source');
    }
    if (repeatedCases.has(c.id)) reasons.push('repeated_underlying_source');
    if (reasons.length) flagged.push({case_id:c.id,case_number:c.case_number,reasons});
  }
  summary.unique_referenced_sources = used.size;
  summary.unique_referenced_sources_not_marked_published =
    [...used].filter(sourceId => sources.get(sourceId).published !== true).length;
  flagged.sort((a,b) => a.case_number-b.case_number || a.case_id-b.case_id);
  // Only numeric IDs and reason codes: no titles, URLs, descriptions or private notes.
  return {summary,flagged_case_count:flagged.length,
    flagged_cases:flagged.slice(0,50),omitted_flagged_cases:Math.max(0,flagged.length-50),
    repeated_underlying_source_pairs:repeated.slice(0,25),
    omitted_repeated_pairs:Math.max(0,repeated.length-25),
    caveat:'Register references may repeat a source. Shared URLs or source IDs are not independent corroboration; metadata completion does not verify claims.'};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Requires a complete snapshot');
    const data = JSON.parse(readFileSync(resolve(process.argv[2]),'utf8'));
    process.stdout.write(JSON.stringify(auditCaseSourceCoverage(data),null,2)+'\n');
  } catch {
    process.stderr.write('Offline case provenance audit failed: invalid or incomplete snapshot.\n');
    process.exitCode = 1;
  }
}
