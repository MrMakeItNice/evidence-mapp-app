import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Offline, reviewer-only cross-collection links by the public GAO report ID.
 * This does NOT establish that two records describe the same story, verify a
 * claim, enrich sources, connect to services, or modify/publish any data.
 * Input: { newsItems:[], sources:[], researchInbox:[] }, each with numeric id,
 * title/headline and optionally source_url/url. Output never contains raw
 * titles or URLs, including query strings, credentials or error bodies.
 */
const MAX_ROWS = 100_000;
const MAX_SAMPLES = 25;
const REPORT_ID = /\bGAO-(\d{2})-(\d{6})\b/gi;
const KINDS = [
  ['newsItems', 'news', 'headline', 'source_url'],
  ['sources', 'source', 'title', 'url'],
  ['researchInbox', 'inbox', 'title', 'source_url']
];

function textIds(value) {
  if (typeof value !== 'string' || value.length > 2048) return [];
  const matches = [...value.matchAll(REPORT_ID)];
  return [...new Set(matches.map(m => 'GAO-' + m[1] + '-' + m[2]))];
}

function officialUrlIds(value) {
  if (typeof value !== 'string' || value.length > 4096) return [];
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password ||
        !['gao.gov', 'www.gao.gov', 'files.gao.gov'].includes(u.hostname.toLowerCase())) return [];
    const match = u.pathname.match(/^\/(?:products|reports)\/(gao-\d{2}-\d{6})(?:\/|$)/i);
    return match ? [match[1].toUpperCase()] : [];
  } catch { return []; }
}

export function suggestReportIdLinks({ newsItems = [], sources = [], researchInbox = [] } = {}) {
  const collections = { newsItems, sources, researchInbox };
  if (!Object.values(collections).every(x => Array.isArray(x) && x.length <= MAX_ROWS)) {
    throw new TypeError('Expected three bounded arrays.');
  }
  const groups = new Map();
  let ignored_rows = 0, conflicting_identifier_rows = 0;
  for (const [key, kind, titleField, urlField] of KINDS) {
    for (const row of collections[key]) {
      if (!row || !Number.isSafeInteger(row.id) || row.id <= 0) { ignored_rows++; continue; }
      const fromTitle = textIds(row[titleField]);
      const fromUrl = officialUrlIds(row[urlField]);
      const all = [...new Set([...fromTitle, ...fromUrl])];
      if (all.length > 1) { conflicting_identifier_rows++; continue; }
      if (!all.length) { ignored_rows++; continue; }
      const id = all[0];
      if (!groups.has(id)) groups.set(id, new Map());
      const bucket = groups.get(id);
      if (!bucket.has(kind)) bucket.set(kind, []);
      bucket.get(kind).push({ id: row.id, collection: kind,
        evidence: fromUrl.length && fromTitle.length ? 'title_and_official_url' :
          fromUrl.length ? 'official_url' : 'title_mention' });
    }
  }
  let matched_report_count = 0, pair_candidate_count = 0;
  const sample_candidates = [], ambiguous_report_ids = [];
  for (const reportId of [...groups.keys()].sort()) {
    const buckets = groups.get(reportId);
    const entries = [...buckets.values()].flat();
    // Two rows in one collection may represent versions or different stories.
    // Do not infer a unique counterpart when any collection is ambiguous.
    if ([...buckets.values()].some(rows => rows.length > 1)) {
      ambiguous_report_ids.push(reportId);
      continue;
    }
    if (entries.length < 2) continue;
    matched_report_count++;
    for (let a = 0; a < entries.length; a++) for (let b = a + 1; b < entries.length; b++) {
      pair_candidate_count++;
      if (sample_candidates.length < MAX_SAMPLES) {
        sample_candidates.push({ report_id: reportId, left: entries[a], right: entries[b],
          status: 'editorial_review_required' });
      }
    }
  }
  return {
    matched_report_count, pair_candidate_count, sample_candidates,
    ambiguous_report_ids, conflicting_identifier_rows, ignored_rows,
    caveat: 'Report-ID correlation is an editorial lead, not proof of story identity, corroboration, or eligibility for publication. Confirm original documents and context; never auto-link.'
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const raw = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    process.stdout.write(JSON.stringify(suggestReportIdLinks(JSON.parse(raw)), null, 2) + '\n');
  } catch {
    process.stderr.write('Report identifier audit failed: invalid input.\n');
    process.exitCode = 1;
  }
}
