#!/usr/bin/env node
// Offline, read-only triage age diagnostic. Never calls a network/database API.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const QUEUES = ['news_items', 'research_inbox'];

function validTime(value, allowMissing = false) {
  if (allowMissing && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) throw new Error('Invalid timestamp format');
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new Error('Invalid timestamp value');
  return millis;
}

function validId(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return value;
  return null;
}

/** Produce aggregate-only counts, not titles, URLs, notes or any original records. */
export function auditReviewQueueAge(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Invalid snapshot');
  const asOfMs = validTime(snapshot.as_of);
  const expected = snapshot.expected_counts;
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) throw new Error('Missing expected counts');

  const queues = {};
  for (const queue of QUEUES) {
    const records = snapshot[queue];
    const count = expected[queue];
    if (!Number.isSafeInteger(count) || count < 0 || !Array.isArray(records) || records.length !== count) {
      throw new Error('Incomplete or invalid queue snapshot');
    }
    const seen = new Set();
    const metrics = {
      total: count,
      pending: 0,
      older_than_7_days: 0,
      older_than_14_days: 0,
      pending_missing_discovery: 0,
      pending_future_discovery: 0,
    };
    for (const record of records) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid record');
      const id = validId(record.id);
      if (!id || seen.has(id)) throw new Error('Invalid or repeated record ID');
      seen.add(id);
      if (typeof record.review_status !== 'string' || !record.review_status.trim()) {
        throw new Error('Missing review status');
      }
      const discovery = validTime(record.discovered_at, true);
      if (record.review_status !== 'pending') continue;
      metrics.pending += 1;
      if (discovery === null) {
        metrics.pending_missing_discovery += 1;
      } else if (discovery > asOfMs) {
        metrics.pending_future_discovery += 1;
      } else {
        if (asOfMs - discovery > 7 * DAY_MS) metrics.older_than_7_days += 1;
        if (asOfMs - discovery > 14 * DAY_MS) metrics.older_than_14_days += 1;
      }
    }
    queues[queue] = metrics;
  }
  return { as_of: snapshot.as_of, basis: 'discovered_at_not_publication_date', queues };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Missing snapshot file');
    const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    process.stdout.write(JSON.stringify(auditReviewQueueAge(snapshot), null, 2) + '\n');
  } catch {
    // Never echo record data or paths: input may contain sensitive research material.
    process.stderr.write('Review-queue audit failed: invalid, incomplete, or unreadable snapshot.\n');
    process.exitCode = 1;
  }
}
