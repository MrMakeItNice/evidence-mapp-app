import { readFileSync } from 'node:fs';

// Offline, review-only audit. All nine source-reference families are REQUIRED;
// omitting one would falsely classify legitimately cited sources as orphans.
// No database/network calls and no data changes. Output contains IDs only.
export const SOURCE_REFERENCE_FIELDS = Object.freeze({
  master_source_register: 'source_id',
  claim_sources: 'source_id',
  investigation_group_sources: 'source_id',
  investigation_group_events: 'source_id',
  relationships: 'source_id_reference',
  possible_outcomes: 'source_id',
  outcome_evidence: 'source_id',
  scenario_evidence: 'source_id',
  solution_candidate_evidence: 'source_id',
});
const MAX_RECORDS = 200_000;
const positiveId = id => Number.isSafeInteger(id) && id > 0;
const assertArray = value => {
  if (!Array.isArray(value) || value.length > MAX_RECORDS) {
    throw new TypeError('Invalid array in offline snapshot');
  }
};

export function reviewSourceReferenceCoverage({ sources, references } = {}) {
  assertArray(sources);
  if (!references || typeof references !== 'object' || Array.isArray(references)) {
    throw new TypeError('All source-reference families are required');
  }
  const keys = Object.keys(SOURCE_REFERENCE_FIELDS);
  if (Object.keys(references).length !== keys.length ||
      Object.keys(references).some(key => !Object.hasOwn(SOURCE_REFERENCE_FIELDS, key))) {
    throw new TypeError('Source-reference family set is incomplete or unknown');
  }
  const sourceById = new Map();
  for (const row of sources) {
    if (!row || typeof row !== 'object' || !positiveId(row.id) || sourceById.has(row.id)) {
      throw new TypeError('Invalid or duplicate source ID');
    }
    sourceById.set(row.id, row);
  }

  const linked = new Set();
  const unknown = new Set();
  const familyCounts = {};
  const nullReferenceCounts = {};
  for (const [family, field] of Object.entries(SOURCE_REFERENCE_FIELDS)) {
    const records = references[family];
    assertArray(records);
    const matching = new Set();
    let nulls = 0;
    for (const row of records) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new TypeError('Invalid source-reference row');
      }
      const id = row[field];
      if (id === null || id === undefined) { nulls++; continue; }
      if (!positiveId(id)) throw new TypeError('Invalid source reference ID');
      if (sourceById.has(id)) { matching.add(id); linked.add(id); }
      else unknown.add(id);
    }
    familyCounts[family] = matching.size;
    nullReferenceCounts[family] = nulls;
  }
  const orphanIds = [...sourceById.keys()].filter(id => !linked.has(id)).sort((a,b)=>a-b);
  return {
    inspected_sources: sources.length,
    linked_sources: linked.size,
    unlinked_source_ids: orphanIds,
    published_unlinked_source_ids: orphanIds.filter(id => sourceById.get(id).published === true),
    unknown_reference_source_ids: [...unknown].sort((a,b)=>a-b),
    distinct_sources_by_family: familyCounts,
    null_reference_counts: nullReferenceCounts,
    status: 'review_only',
    caveat: 'A source without structured references may still appear in case text or external records. Never delete, relink or publish automatically.',
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const raw = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    process.stdout.write(JSON.stringify(reviewSourceReferenceCoverage(JSON.parse(raw)), null, 2) + '\n');
  } catch {
    process.stderr.write('Source reference coverage review failed: incomplete or invalid local snapshot.\n');
    process.exitCode = 1;
  }
}
