// Run with: node --test tests/evidence-board-smoke.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../evidence-board.html', import.meta.url), 'utf8');

test('Evidence Board retains source-backed, read-only loading', () => {
  assert.match(html, /fetch\(api\)/, 'published cases must load from the public API');
  assert.match(html, /fetch\('\.\/paper-trails-data\.json'\)/, 'source references must load from published data');
  assert.match(html, /String\(r\.case_id\)===String\(id\)/, 'citations must be scoped to the selected case');
  assert.match(html, /No sample evidence has been substituted/, 'service failure must not invent evidence');
  assert.doesNotMatch(html, /fetch\([^)]*,\s*\{\s*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i, 'the public board must not write remote records');
});

test('Evidence Board identifies citations without implying wrongdoing', () => {
  assert.match(html, /does not establish causation or misconduct/);
  assert.match(html, /indexed metadata, not original scans/);
  assert.match(html, /Open original source/);
});
