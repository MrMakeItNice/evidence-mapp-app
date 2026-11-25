import { readFileSync } from 'node:fs';

/** Offline, human-review-only structural evidence coverage audit.
 * Inputs are caller-provided JSON snapshots. No network, database operations,
 * record mutation, source interpretation, or automatic link suggestions.
 * Reports only numeric IDs/counts; titles, URLs and notes never leave input.
 */
const LIMIT = 100000;
function safeId(id, label) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new TypeError(`Invalid ${label}`);
  return id;
}
function index(rows, label) {
  if (!Array.isArray(rows) || rows.length > LIMIT) throw new TypeError(`Invalid ${label} array`);
  const ids = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError(`Invalid ${label} row`);
    const id = safeId(row.id, `${label}.id`);
    if (ids.has(id)) throw new TypeError(`Duplicate ${label} id`);
    ids.set(id, row);
  }
  return ids;
}
function sorted(xs) { return [...new Set(xs)].sort((a,b) => a-b); }
function requireLinkRows(rows, label) {
  if (!Array.isArray(rows) || rows.length > LIMIT) throw new TypeError(`Invalid ${label} array`);
  for (const row of rows) if (!row || typeof row !== 'object' || Array.isArray(row)) throw new TypeError(`Invalid ${label} row`);
}

export function auditCaseEvidenceCoverage({cases=[], sources=[], masterSourceRegister=[],
  caseSourceReferences=[], claims=[], claimSources=[]}={}) {
  const c = index(cases, 'cases');
  const s = index(sources, 'sources');
  const register = index(masterSourceRegister, 'masterSourceRegister');
  const cl = index(claims, 'claims');
  requireLinkRows(caseSourceReferences, 'caseSourceReferences');
  requireLinkRows(claimSources, 'claimSources');
  const caseWithRegister = new Set(), claimWithSource = new Set();
  const orphanCaseLinkIds = [], orphanRegisterIds = [], registerWithoutSourceIds = [],
    orphanSourceIdLinks = [], duplicateCaseRegisterLinks = [], duplicateClaimSourceLinks = [],
    claimsMissingCaseIds = [], orphanClaimLinkIds = [], orphanClaimSourceIds = [];
  const seenCaseRefs = new Set(), seenClaimRefs = new Set();
  const caseSourceViaRegisters = new Map();
  for (const [id, row] of register) {
    if (row.source_id == null) { registerWithoutSourceIds.push(id); continue; }
    const sourceId = safeId(row.source_id, 'register.source_id');
    if (!s.has(sourceId)) orphanSourceIdLinks.push(id);
  }
  for (const row of caseSourceReferences) {
    const caseId = safeId(row.case_id, 'caseSourceReferences.case_id');
    const registerId = safeId(row.register_id, 'caseSourceReferences.register_id');
    const key = `${caseId}:${registerId}`;
    if (seenCaseRefs.has(key)) duplicateCaseRegisterLinks.push({case_id:caseId, register_id:registerId});
    seenCaseRefs.add(key);
    if (!c.has(caseId)) orphanCaseLinkIds.push(caseId);
    if (!register.has(registerId)) orphanRegisterIds.push(registerId);
    if (c.has(caseId) && register.has(registerId)) {
      caseWithRegister.add(caseId);
      const sourceId = register.get(registerId).source_id;
      if (sourceId != null && s.has(sourceId)) {
        const caseSourceKey = `${caseId}:${sourceId}`;
        if (!caseSourceViaRegisters.has(caseSourceKey)) caseSourceViaRegisters.set(caseSourceKey,new Set());
        caseSourceViaRegisters.get(caseSourceKey).add(registerId);
      }
    }
  }
  for (const [id, row] of cl) {
    if (row.case_id == null || !c.has(safeId(row.case_id, 'claims.case_id'))) claimsMissingCaseIds.push(id);
  }
  for (const row of claimSources) {
    const claimId = safeId(row.claim_id, 'claimSources.claim_id');
    const sourceId = safeId(row.source_id, 'claimSources.source_id');
    const key = `${claimId}:${sourceId}`;
    if (seenClaimRefs.has(key)) duplicateClaimSourceLinks.push({claim_id:claimId, source_id:sourceId});
    seenClaimRefs.add(key);
    if (!cl.has(claimId)) orphanClaimLinkIds.push(claimId);
    if (!s.has(sourceId)) orphanClaimSourceIds.push(sourceId);
    if (cl.has(claimId) && s.has(sourceId)) claimWithSource.add(claimId);
  }
  const multiRegisterCaseSourceReviewCandidates = [...caseSourceViaRegisters]
    .filter(([,ids])=>ids.size > 1)
    .map(([key,ids])=>{
      const [case_id,source_id] = key.split(':').map(Number);
      return {case_id,source_id,register_ids:[...ids].sort((a,b)=>a-b)};
    })
    .sort((a,b)=>a.case_id-b.case_id || a.source_id-b.source_id);
  const caseIdsWithClaims=new Set([...cl.values()].filter(v=>v.case_id != null && c.has(v.case_id)).map(v=>v.case_id));
  return {
    cases_total:c.size, cases_with_registered_source_links:caseWithRegister.size,
    cases_without_registered_source_link_ids:sorted([...c.keys()].filter(id=>!caseWithRegister.has(id))),
    claims_total:cl.size, cases_without_structured_claim_ids:sorted([...c.keys()].filter(id=>!caseIdsWithClaims.has(id))),
    claims_without_source_link_ids:sorted([...cl.keys()].filter(id=>!claimWithSource.has(id))),
    orphan_case_link_ids:sorted(orphanCaseLinkIds), orphan_register_link_ids:sorted(orphanRegisterIds),
    register_rows_without_source_ids:sorted(registerWithoutSourceIds), orphan_source_register_ids:sorted(orphanSourceIdLinks),
    claims_without_valid_case_ids:sorted(claimsMissingCaseIds), orphan_claim_link_ids:sorted(orphanClaimLinkIds),
    orphan_claim_source_ids:sorted(orphanClaimSourceIds),
    duplicate_case_register_links:duplicateCaseRegisterLinks, duplicate_claim_source_links:duplicateClaimSourceLinks,
    multi_register_same_source_review_candidates:multiRegisterCaseSourceReviewCandidates,
    caveat:'Only structural linkage is assessed. No registered source link or structured claim does NOT establish a case is unsupported. Review other evidence fields, imported references, case status and publisher originals; never auto-create, merge or publish records. Multiple register entries for one case/source may represent distinct citations and must not be auto-deduplicated.'
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const raw=process.argv[2]?readFileSync(process.argv[2],'utf8'):readFileSync(0,'utf8');
    process.stdout.write(JSON.stringify(auditCaseEvidenceCoverage(JSON.parse(raw)),null,2)+'\n');
  } catch { process.stderr.write('Evidence coverage audit failed: invalid snapshot.\n'); process.exitCode=1; }
}
