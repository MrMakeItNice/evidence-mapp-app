import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditNewsInboxOverlaps } from '../scripts/audit-news-inbox-overlaps.mjs';

const stamp = '2026-11-20T18:00:00Z';
function example() {
  return {
    expected_counts: { news_items: 2, research_inbox: 2 },
    news_items: [
      { id: 1, source_url: 'https://example.org/a', headline: 'Original headline', publisher: 'Publisher A', published_at: stamp, review_status: 'pending', assessment: 'unassessed', topic_id: 99 },
      { id: 2, source_url: 'https://example.org/b', headline: 'Other headline', publisher: 'Publisher B', published_at: null, review_status: 'pending', assessment: 'unassessed' }
    ],
    research_inbox: [
      { id: 8, source_url: 'https://example.org/a', title: 'Edited headline', publisher: 'Publisher A', published_at: '2026-11-20T10:00:00-08:00', review_status: 'pending', assessment: 'unassessed', watch_topic_id: 99 },
      { id: 9, source_url: 'https://example.org/c', title: 'Another', publisher: 'Publisher C', published_at: null, review_status: 'pending', assessment: 'unassessed' }
    ]
  };
}

test('links only exact URL pairs and flags heading variants without merging', () => {
  const result = auditNewsInboxOverlaps(example());
  assert.equal(result.totals.exact_url_pairs, 1);
  assert.equal(result.totals.title_variants, 1);
  assert.equal(result.totals.publication_time_variants, 0);
  assert.deepEqual(result.review_pairs.map(p => [p.news_id, p.inbox_id]), [[1, 8]]);
});

test('same publisher and date formats are equivalent after conservative normalization', () => {
  const x = example();
  x.research_inbox[0].title = '  original   HEADLINE  ';
  x.research_inbox[0].publisher = ' publisher  a ';
  const result = auditNewsInboxOverlaps(x);
  assert.equal(result.totals.title_variants, 0);
  assert.equal(result.totals.publisher_variants, 0);
});

test('query strings, paths and URL case are not silently collapsed', () => {
  const x = example();
  x.research_inbox[0].source_url = 'https://example.org/a?tracking=1';
  assert.equal(auditNewsInboxOverlaps(x).totals.exact_url_pairs, 0);
  x.research_inbox[0].source_url = 'https://EXAMPLE.org/a';
  assert.equal(auditNewsInboxOverlaps(x).totals.exact_url_pairs, 0);
});

test('all review and provenance disagreements remain advisory flags', () => {
  const x = example();
  Object.assign(x.research_inbox[0], { publisher: 'Other Agency', published_at: null, review_status: 'reviewed', assessment: 'disputed' });
  const flags = auditNewsInboxOverlaps(x).review_pairs[0].flags;
  assert.deepEqual(flags, {
    title_variant: true, publisher_variant: true, publication_time_variant: true,
    review_status_variant: true, assessment_variant: true
  });
});

test('requires both complete snapshot counts to prevent silent undercounts', () => {
  const x = example();
  x.expected_counts.news_items = 99;
  assert.throws(() => auditNewsInboxOverlaps(x), /Incomplete/);
  delete x.expected_counts.news_items;
  assert.throws(() => auditNewsInboxOverlaps(x), /Incomplete/);
});

test('rejects duplicate IDs, duplicate URLs, and non-positive identifiers', () => {
  const x = example();
  x.news_items[1].id = 1;
  assert.throws(() => auditNewsInboxOverlaps(x), /identifier/);
  x.news_items[1].id = 2;
  x.news_items[1].source_url = x.news_items[0].source_url;
  assert.throws(() => auditNewsInboxOverlaps(x), /URL/);
  x.news_items[1].source_url = 'https://example.org/b';
  x.news_items[1].id = 0;
  assert.throws(() => auditNewsInboxOverlaps(x), /identifier/);
});

test('rejects malformed URL, invalid timezone-free publication dates and missing review fields', () => {
  const x = example();
  x.news_items[0].source_url = 'javascript:hello';
  assert.throws(() => auditNewsInboxOverlaps(x), /URL/);
  x.news_items[0].source_url = 'https://example.org/a';
  x.news_items[0].published_at = '2026-11-20T18:00:00';
  assert.throws(() => auditNewsInboxOverlaps(x), /timezone/);
  x.news_items[0].published_at = stamp;
  delete x.news_items[0].assessment;
  assert.throws(() => auditNewsInboxOverlaps(x), /review metadata/);
});

test('never outputs raw URLs, titles, publishers or notes containing private material', () => {
  const x = example();
  x.news_items[0].source_url = x.research_inbox[0].source_url = 'https://example.org/a?private_token=SECRET123';
  x.news_items[0].headline = 'CONFIDENTIAL HEADLINE';
  x.news_items[0].publisher = 'CONFIDENTIAL PUBLISHER';
  x.news_items[0].summary = 'CONFIDENTIAL NOTES';
  const serialized = JSON.stringify(auditNewsInboxOverlaps(x));
  for (const part of ['SECRET123', 'CONFIDENTIAL', 'example.org']) assert.ok(!serialized.includes(part), part);
});

test('does not conflate news topic IDs with research watch IDs', () => {
  const x = example();
  x.news_items[0].topic_id = 21;
  x.research_inbox[0].watch_topic_id = 21;
  const result = auditNewsInboxOverlaps(x);
  assert.equal(result.totals.exact_url_pairs, 1);
  assert.ok(!JSON.stringify(result).includes('topic_id'));
});

test('CLI reads a local complete snapshot and redacts invalid input details', () => {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-audit-'));
  const script = fileURLToPath(new URL('../scripts/audit-news-inbox-overlaps.mjs', import.meta.url));
  try {
    const file = join(dir, 'snapshot.json');
    writeFileSync(file, JSON.stringify(example()));
    const ok = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(JSON.parse(ok.stdout).totals.exact_url_pairs, 1);
    writeFileSync(file, '{"secret":"PRIVATE_VALUE",');
    const invalid = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.ok(!invalid.stderr.includes('PRIVATE_VALUE'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
