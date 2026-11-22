#!/usr/bin/env node
// Offline, read-only source metadata triage. Never contacts Supabase or publishes records.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function idOf(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return value;
  throw new Error('Invalid source ID');
}
function missingText(value) {
  if (value === null) return true;
  if (typeof value !== 'string') throw new Error('Invalid metadata field');
  return !value.trim();
}
function missingDate(value) {
  if (value === null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid publication date');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Invalid publication date');
  return false;
}

/** Input must be a full, local snapshot of public.sources; output contains only counts and published record IDs. */
export function auditSourcePublicationMetadata(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Invalid snapshot');
  const { expected_count: expected, sources } = snapshot;
  if (!Number.isSafeInteger(expected) || expected < 0 || !Array.isArray(sources) || sources.length !== expected) {
    throw new Error('Incomplete source snapshot');
  }
  const seen = new Set();
  const result = {
    total: expected,
    published: { total: 0, missing_publisher_ids: [], missing_date_ids: [], missing_url_ids: [] },
    unpublished: { total: 0, missing_publisher: 0, missing_date: 0, missing_url: 0, bibliography_records: 0 },
  };
  for (const record of sources) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid source record');
    const id = idOf(record.id);
    if (seen.has(id)) throw new Error('Duplicate source ID');
    seen.add(id);
    if (typeof record.published !== 'boolean') throw new Error('Invalid publication flag');
    if (record.source_type !== null && typeof record.source_type !== 'string') throw new Error('Invalid source type');
    const noPublisher = missingText(record.publisher);
    const noDate = missingDate(record.publication_date);
    const noUrl = missingText(record.url);
    if (record.published) {
      result.published.total += 1;
      if (noPublisher) result.published.missing_publisher_ids.push(id);
      if (noDate) result.published.missing_date_ids.push(id);
      if (noUrl) result.published.missing_url_ids.push(id);
    } else {
      result.unpublished.total += 1;
      if (noPublisher) result.unpublished.missing_publisher += 1;
      if (noDate) result.unpublished.missing_date += 1;
      if (noUrl) result.unpublished.missing_url += 1;
      if (record.source_type === 'master_index_bibliography') result.unpublished.bibliography_records += 1;
    }
  }
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 3) throw new Error('Expected one snapshot path');
    const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    console.log(JSON.stringify(auditSourcePublicationMetadata(snapshot), null, 2));
  } catch {
    console.error('Invalid or incomplete local source snapshot');
    process.exitCode = 1;
  }
}
