// Run: node --test tests/pulse-globe-integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const feed = JSON.parse(readFileSync(new URL('../global-evidence-pulse.json', import.meta.url), 'utf8'));

test('Pulse renders three honest categories with accessible status', () => {
  for (const category of ['positive', 'negative', 'neutral']) {
    assert.match(page, new RegExp('id="atlas-' + category + '"'));
  }
  assert.match(page, /id="atlas-pulse-status"[^>]*role="status"/);
  assert.match(page, /Awaiting verified data/);
  assert.match(page, /Live tally temporarily unavailable/);
  assert.match(page, /not representative of all news/);
});

test('Pulse never invents scores or counts duplicate and unreviewed events', () => {
  assert.match(page, /fetch\('\.\/global-evidence-pulse\.json',\{cache:'no-store'\}\)/);
  assert.match(page, /e\.review_status==='verified'/);
  assert.match(page, /e\.classification_rationale&&e\.reviewer&&e\.reviewed_at/);
  assert.match(page, /ids\.has\(event\.id\)/);
  assert.match(page, /if\(!reviewed\.length\)/);
  assert.ok(Array.isArray(feed.events));
  assert.match(feed.methodology, /unavailable, not zero/i);
});

test('Globe polish is subtle and wheel scrolling is opt-in', () => {
  assert.equal((page.match(/const rimGlow=/g) || []).length, 1);
  assert.match(page, /depthWrite:false,side:THREE\.BackSide/);
  assert.match(page, /document\.activeElement!==canvas/);
  assert.match(page, /prefers-reduced-motion: reduce/);
});
