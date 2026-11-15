#!/usr/bin/env node
// Read-only editorial contract check. Run: node scripts/check-pulse-feed.cjs
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../global-evidence-pulse.json');
const errors = [];
let feed;
try { feed = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (error) { console.error('Pulse feed cannot be read:', error.message); process.exit(1); }
if (feed.schema_version !== 1) errors.push('schema_version must equal 1');
if (!Array.isArray(feed.events)) errors.push('events must be an array');
if (typeof feed.methodology !== 'string' || !feed.methodology.trim()) errors.push('methodology is required');
const ids = new Set();
const isDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
};
const https = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname; }
  catch { return false; }
};
for (const [index, event] of (Array.isArray(feed.events) ? feed.events : []).entries()) {
  const at = 'events[' + index + ']';
  if (!event || typeof event !== 'object' || Array.isArray(event)) { errors.push(at + ': expected object'); continue; }
  if (typeof event.id !== 'string' || !event.id.trim()) errors.push(at + ': missing ID');
  else if (ids.has(event.id)) errors.push(at + ': duplicate ID ' + event.id);
  else ids.add(event.id);
  if (typeof event.title !== 'string' || !event.title.trim()) errors.push(at + ': missing title');
  if (!['positive', 'negative', 'neutral'].includes(event.category)) errors.push(at + ': invalid category');
  if (event.review_status !== 'verified') errors.push(at + ': only verified records may be in public feed');
  if (!isDate(event.event_date)) errors.push(at + ': invalid occurrence date');
  if (typeof event.lat !== 'number' || !Number.isFinite(event.lat) || Math.abs(event.lat) > 90) errors.push(at + ': invalid latitude');
  if (typeof event.lon !== 'number' || !Number.isFinite(event.lon) || Math.abs(event.lon) > 180) errors.push(at + ': invalid longitude');
  if (!https(event.source_url)) errors.push(at + ': original HTTPS source URL required');
  if (event.additional_source_urls !== undefined && (!Array.isArray(event.additional_source_urls) || !event.additional_source_urls.every(https))) errors.push(at + ': invalid additional source URLs');
  if (event.counterevidence_urls !== undefined && (!Array.isArray(event.counterevidence_urls) || !event.counterevidence_urls.every(https))) errors.push(at + ': invalid counterevidence URLs');
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Pulse contract valid: ' + ids.size + ' reviewed events (empty feed is permitted; not a zero-world-events claim).');
