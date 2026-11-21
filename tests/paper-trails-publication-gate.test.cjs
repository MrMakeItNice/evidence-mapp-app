// Static Paper Trails source-publication snapshot regression.
// Run: node --test tests/paper-trails-publication-gate.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'paper-trails-data.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'paper-trails.html'), 'utf8');
const gate = data.publication_gate;

test('export records its explicit source-publication gate and snapshot date', () => {
  assert.equal(gate.field, 'public.sources.published');
  assert.match(gate.checked_on, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(data.generated_on, gate.checked_on);
  assert.match(data.note, /not independent verification/i);
});

test('all static source links are present in the approved snapshot allowlist', () => {
  assert.ok(Array.isArray(data.references) && data.references.length > 0);
  const ids = gate.approved_source_ids;
  assert.ok(Array.isArray(ids) && ids.length > 0);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
  assert.equal(new Set(ids).size, ids.length);
  const seen = new Set();
  for (const ref of data.references) {
    assert.ok(Number.isInteger(ref.source_id) && ref.source_id > 0);
    assert.ok(Number.isInteger(ref.case_id) && ref.case_id > 0);
    assert.ok(ids.includes(ref.source_id), 'source ' + ref.source_id + ' not marked published at export');
    seen.add(ref.source_id);
  }
  assert.deepEqual(seen, new Set(ids));
  assert.equal(data.references.length, gate.reference_count);
  assert.equal(seen.size, gate.distinct_source_count);
});

test('known unapproved sources from QA #341 remain excluded until intentional review', () => {
  const ids = new Set(data.references.map(ref => ref.source_id));
  for (const id of [8, 18, 20, 34, 60]) assert.equal(ids.has(id), false, 'source ' + id + ' requires new editorial check');
});

test('Paper Trails filters source links by the allowlist and reports snapshot status', () => {
  assert.match(html, /approvedSourceIds=new Set\(gateReady\?/);
  assert.match(html, /d\.references\.filter\(r=>approvedSourceIds\.has\(String\(r\.source_id\)\)\)/);
  assert.match(html, /id="sourceGate"/);
  assert.match(html, /Source publication gate unavailable; citation links are withheld/);
});
