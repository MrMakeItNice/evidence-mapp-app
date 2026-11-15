// Run: node --test tests/global-evidence-pulse-integrity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pulse = JSON.parse(readFileSync(new URL('../global-evidence-pulse.json', import.meta.url), 'utf8'));
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const isHttps = value => {
  if (typeof value !== 'string') return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
};

test('Pulse discloses curated selection bias and never treats an empty feed as zero', () => {
  assert.equal(pulse.schema_version, 1);
  assert.ok(Array.isArray(pulse.events));
  assert.match(pulse.methodology, /curated/i);
  assert.match(pulse.methodology, /bias/i);
  assert.match(pulse.methodology, /unavailable, not zero/i);
});

test('Every published Pulse event is reviewed, sourced, dated, and uniquely identified', () => {
  const ids = new Set();
  for (const event of pulse.events) {
    assert.ok(typeof event.id === 'string' && event.id.trim(), 'stable event id required');
    assert.ok(!ids.has(event.id), 'duplicate event id: ' + event.id);
    ids.add(event.id);
    assert.ok(typeof event.title === 'string' && event.title.trim(), 'event title required');
    assert.ok(['positive', 'negative', 'neutral'].includes(event.category), 'unknown category: ' + event.id);
    assert.equal(event.review_status, 'verified', 'unreviewed event cannot enter published Pulse: ' + event.id);
    assert.ok(datePattern.test(event.event_date) && !Number.isNaN(Date.parse(event.event_date)), 'valid event date required: ' + event.id);
    assert.ok(Number.isFinite(event.lat) && event.lat >= -90 && event.lat <= 90, 'valid latitude required: ' + event.id);
    assert.ok(Number.isFinite(event.lon) && event.lon >= -180 && event.lon <= 180, 'valid longitude required: ' + event.id);
    assert.ok(isHttps(event.source_url), 'HTTPS original source required: ' + event.id);
    assert.ok(typeof event.classification_rationale === 'string' && event.classification_rationale.trim(), 'classification rationale required: ' + event.id);
    assert.ok(typeof event.reviewer === 'string' && event.reviewer.trim(), 'reviewer required: ' + event.id);
    assert.ok(typeof event.reviewed_at === 'string' && !Number.isNaN(Date.parse(event.reviewed_at)), 'review timestamp required: ' + event.id);
    for (const url of [...(event.additional_source_urls || []), ...(event.counterevidence_urls || [])]) {
      assert.ok(isHttps(url), 'supplementary evidence must use HTTPS: ' + event.id);
    }
  }
});

test('Publication contract explicitly supports contrary evidence and corrections', () => {
  assert.match(pulse.event_contract.optional_fields.join(' '), /counterevidence_urls/);
  assert.match(pulse.event_contract.optional_fields.join(' '), /correction_note/);
  assert.match(pulse.review_policy.join(' '), /contradictory evidence/i);
  assert.match(pulse.review_policy.join(' '), /distinct events/i);
});
