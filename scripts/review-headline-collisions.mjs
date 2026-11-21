import { readFileSync } from 'node:fs';

/**
 * Advisory-only exact normalized-headline collision review.
 * Input is an offline array of existing news items. No network, database,
 * source attribution, linking, mutation or publication. Output contains IDs,
 * not raw headlines, URLs, summaries, or other article content.
 *
 * Matching headlines are only REVIEW CANDIDATES: republications, live updates,
 * topic pages, translated titles and distinct articles may share a headline.
 */
function normalizeHeadline(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/\p{Cf}/gu, '') // remove hidden format characters (e.g., soft hyphen)
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function validId(value) {
  return (typeof value === 'number' && Number.isSafeInteger(value)) ||
    (typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value));
}

export function reviewHeadlineCollisions(items) {
  if (!Array.isArray(items)) throw new TypeError('Expected a JSON array of news items');
  const buckets = new Map();
  let ignoredShort = 0;
  let ignoredInvalid = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !validId(item.id)) {
      ignoredInvalid++;
      continue;
    }
    const key = normalizeHeadline(item.headline);
    // Avoid generic headings such as "Inside Health" or "Latest news".
    if (key.length < 45 || key.split(' ').length < 7) { ignoredShort++; continue; }
    const bucket = buckets.get(key) || new Set();
    bucket.add(item.id);
    buckets.set(key, bucket);
  }
  const candidate_groups = [...buckets.values()]
    .map(set => [...set])
    .filter(ids => ids.length > 1)
    .map(ids => ({ ids: ids.sort((a,b) => String(a).localeCompare(String(b))),
      match_reason: 'same_normalized_headline_only', review_status: 'human_review_required' }))
    .sort((a,b) => b.ids.length-a.ids.length || String(a.ids[0]).localeCompare(String(b.ids[0])));
  return { inspected: items.length, ignored_short_titles: ignoredShort,
    ignored_invalid_rows: ignoredInvalid, candidate_groups,
    caveat: 'Headline collisions are not verified duplicates. Review URLs, dates, publishers and versions before deciding; no records were changed.' };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    const content = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8');
    process.stdout.write(JSON.stringify(reviewHeadlineCollisions(JSON.parse(content)), null, 2) + '\n');
  } catch {
    // Avoid echoing error messages containing local paths or untrusted input.
    process.stderr.write('Headline collision review failed (invalid JSON or input).\n');
    process.exitCode = 1;
  }
}
