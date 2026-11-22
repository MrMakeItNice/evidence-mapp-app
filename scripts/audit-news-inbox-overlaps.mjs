// Offline, review-only audit. No network access, SQL, or automatic record changes.
// Usage: node scripts/audit-news-inbox-overlaps.mjs complete-snapshot.json
import { readFileSync } from 'node:fs';

export function auditNewsInboxOverlaps(snapshot) {
  const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!obj(snapshot) || !obj(snapshot.expected_counts)) throw new Error('Missing complete snapshot counts');
  const normalized = value => value == null ? null : value.trim().replace(/\s+/g, ' ').toLowerCase();

  function validate(collection, heading) {
    const items = snapshot[collection];
    const count = snapshot.expected_counts[collection];
    if (!Array.isArray(items) || !Number.isSafeInteger(count) || count < 0 || count !== items.length) {
      throw new Error('Incomplete or invalid ' + collection + ' snapshot');
    }
    const ids = new Set(), urls = new Set();
    for (const item of items) {
      if (!obj(item) || !Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id)) {
        throw new Error('Invalid or repeated record identifier');
      }
      ids.add(item.id);
      if (typeof item.source_url !== 'string' ||
          !/^https?:\/\/[^\s]+$/i.test(item.source_url) || urls.has(item.source_url)) {
        throw new Error('Invalid or repeated source URL');
      }
      urls.add(item.source_url);
      if (typeof item[heading] !== 'string' || !item[heading].trim()) {
        throw new Error('Missing record heading');
      }
      if (item.publisher != null && typeof item.publisher !== 'string') {
        throw new Error('Invalid publisher metadata');
      }
      if (typeof item.review_status !== 'string' || !item.review_status ||
          typeof item.assessment !== 'string' || !item.assessment) {
        throw new Error('Missing review metadata');
      }
      if (item.published_at != null) {
        if (typeof item.published_at !== 'string' ||
            !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/i.test(item.published_at) ||
            !Number.isFinite(Date.parse(item.published_at))) {
          throw new Error('Publication timestamp must include an explicit timezone');
        }
      }
    }
    return items;
  }

  const news = validate('news_items', 'headline');
  const inbox = validate('research_inbox', 'title');
  const inboxByUrl = new Map(inbox.map(item => [item.source_url, item]));
  const review_pairs = [];
  for (const item of news) {
    const related = inboxByUrl.get(item.source_url);
    if (!related) continue;
    const utc = value => value == null ? null : new Date(value).toISOString();
    review_pairs.push({
      news_id: item.id,
      inbox_id: related.id,
      flags: {
        title_variant: normalized(item.headline) !== normalized(related.title),
        publisher_variant: normalized(item.publisher) !== normalized(related.publisher),
        publication_time_variant: utc(item.published_at) !== utc(related.published_at),
        review_status_variant: item.review_status !== related.review_status,
        assessment_variant: item.assessment !== related.assessment
      }
    });
  }
  review_pairs.sort((a, b) => a.news_id - b.news_id || a.inbox_id - b.inbox_id);
  return {
    totals: {
      news_records: news.length,
      inbox_records: inbox.length,
      exact_url_pairs: review_pairs.length,
      title_variants: review_pairs.filter(p => p.flags.title_variant).length,
      publisher_variants: review_pairs.filter(p => p.flags.publisher_variant).length,
      publication_time_variants: review_pairs.filter(p => p.flags.publication_time_variant).length,
      review_status_variants: review_pairs.filter(p => p.flags.review_status_variant).length,
      assessment_variants: review_pairs.filter(p => p.flags.assessment_variant).length
    },
    review_pairs
  };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Expected exactly one local JSON snapshot');
    const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    process.stdout.write(JSON.stringify(auditNewsInboxOverlaps(data), null, 2) + '\n');
  } catch {
    // Deliberately never print input or parser exceptions: they may include private URLs.
    process.stderr.write('Audit not completed: invalid or incomplete local snapshot.\n');
    process.exitCode = 1;
  }
}
