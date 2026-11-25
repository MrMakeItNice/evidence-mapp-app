import test from 'node:test';
import assert from 'node:assert/strict';
import { auditSourcePublicationMetadata as audit } from '../scripts/audit-source-publication-metadata.mjs';

const record = (id, overrides = {}) => ({
  id, published: false, publisher: null, publication_date: null, url: null,
  source_type: 'master_index_bibliography', ...overrides,
});
const snapshot = (sources) => ({ expected_count: sources.length, sources });

test('separates published publication gaps from unpublished bibliography placeholders', () => {
  const report = audit(snapshot([
    record(1),
    record(2, { published: true, source_type: 'primary record', publisher: 'Agency', url: 'https://example.org/doc' }),
    record(3, { published: true, source_type: null, publisher: '', url: '', publication_date: null }),
    record(4, { published: false, source_type: 'reporting', publisher: 'Publisher', publication_date: '2026-11-20', url: 'https://example.org/a' }),
  ]));
  assert.deepEqual(report.published, { total: 2, missing_publisher_ids: ['3'], missing_date_ids: ['2','3'], missing_url_ids: ['3'] });
  assert.deepEqual(report.unpublished, { total: 2, missing_publisher: 1, missing_date: 1, missing_url: 1, bibliography_records: 1 });
});

test('accepts a complete empty export', () => {
  assert.equal(audit(snapshot([])).total, 0);
});

test('rejects incomplete or inconsistent export counts', () => {
  assert.throws(() => audit({expected_count: 5, sources: [record(1)]}), /Incomplete/);
  assert.throws(() => audit({sources: [record(1)]}), /Incomplete/);
});

test('rejects duplicate IDs including numeric/string alias', () => {
  assert.throws(() => audit(snapshot([record(1), record('1')])), /Duplicate/);
});

test('requires explicit publication status and metadata fields', () => {
  const absent = record(1); delete absent.published;
  assert.throws(() => audit(snapshot([absent])), /publication flag/);
  const noDate = record(1); delete noDate.publication_date;
  assert.throws(() => audit(snapshot([noDate])), /publication date/);
});

test('rejects impossible calendar dates but accepts leap days', () => {
  assert.throws(() => audit(snapshot([record(1, { publication_date: '2026-02-29' })])), /date/);
  assert.equal(audit(snapshot([record(1, { publication_date: '2024-02-29' })])).total, 1);
});

test('rejects malformed IDs and metadata types', () => {
  assert.throws(() => audit(snapshot([record(-1)])), /ID/);
  assert.throws(() => audit(snapshot([record(1, { publisher: { secret: 'x' } })])), /metadata/);
  assert.throws(() => audit(snapshot([record(1, { source_type: 22 })])), /source type/);
});

test('never leaks titles, URLs, notes, publisher strings or document text', () => {
  const secret = 'SECRET_DO_NOT_EMIT_927';
  const output = JSON.stringify(audit(snapshot([
    record(1, { published: true, source_type: secret, publisher: secret, url: `https://example.org/?key=${secret}`, title: secret, notes: secret }),
  ])));
  assert.ok(!output.includes(secret));
  assert.deepEqual(JSON.parse(output).published.missing_date_ids, ['1']);
});
