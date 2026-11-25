import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditDateProvenance } from '../scripts/audit-date-provenance.mjs';
const asOf='2026-11-21T17:00:00Z';

test('marks missing publication dates without inventing a replacement', () => {
  const item=Object.freeze({id:1,headline:'Private',source_url:'https://example.com/?token=private',published_at:null,discovered_at:'2026-11-21T16:00:00Z'});
  const result=auditDateProvenance({asOf,newsItems:[item]});
  assert.equal(result.news.counts.missing_publication,1);
  assert.deepEqual(result.news.alerts,[{id:1,flags:['missing_publication']}]);
  assert.equal(JSON.stringify(result).includes('token=private'),false);
  assert.equal(item.published_at,null);
});

test('calendar date tolerance avoids intraday false alarms across time zones', () => {
  const result=auditDateProvenance({asOf, newsItems:[
    {id:1,published_at:'2026-11-22',discovered_at:'2026-11-21T23:59:00-08:00'},
    {id:2,published_at:'2026-11-23',discovered_at:'2026-11-21T00:01:00Z'},
    {id:3,published_at:'2026-11-24',discovered_at:'2026-11-21T20:00:00Z'},
  ]});
  assert.equal(result.news.counts.published_after_discovery,1);
  assert.equal(result.news.counts.future_publication,2);
  assert.deepEqual(result.news.alerts[0],{id:2,flags:['future_publication']});
  assert.deepEqual(result.news.alerts[1],{id:3,flags:['future_publication','published_after_discovery']});
});

test('checks inbox and source publication dates independently', () => {
  const result=auditDateProvenance({asOf,
    inbox:[{id:9,published_at:'2026-11-25',discovered_at:'2026-11-20'}, {id:10,published_at:null,discovered_at:null}],
    sources:[{id:4,publication_date:'2026-12-01'},{id:5,publication_date:null}]});
  assert.equal(result.research_inbox.counts.published_after_discovery,1);
  assert.equal(result.research_inbox.counts.missing_discovery,1);
  assert.equal(result.sources.counts.future_publication,1);
  assert.equal(result.sources.counts.missing_publication,1);
});

test('rejects calendar overflow, invalid timestamp hours, and misleading prefixes', () => {
  const r=auditDateProvenance({asOf,newsItems:[
    {id:1,published_at:'2026-02-30',discovered_at:'2026-11-21'},
    {id:2,published_at:'2026-11-21T25:00:00Z',discovered_at:'2026-11-21'},
    {id:3,published_at:'2026-11-21evil',discovered_at:'2026-11-21'},
    {id:4,published_at:'2024-02-29',discovered_at:'2026-11-21'}]});
  assert.equal(r.news.counts.invalid_publication,3);
  assert.equal(r.news.alerts.some(a=>a.id===4),false);
});

test('invalid/missing discovery and future discovered dates do not imply publication chronology', () => {
  const r=auditDateProvenance({asOf,newsItems:[
    {id:1,published_at:'2026-11-20',discovered_at:'oops'},
    {id:2,published_at:'2026-11-20',discovered_at:null},
    {id:3,published_at:'2026-11-20',discovered_at:'2026-11-29'}]});
  assert.equal(r.news.counts.invalid_discovery,1);
  assert.equal(r.news.counts.missing_discovery,1);
  assert.equal(r.news.counts.future_discovery,1);
  assert.equal(r.news.counts.published_after_discovery,0);
});

test('ignores repeated or unsafe IDs, never echoes private payloads', () => {
  const r=auditDateProvenance({asOf,newsItems:[{id:5,published_at:null},{id:5,published_at:null},{id:'secret-key',published_at:null},null]});
  assert.equal(r.news.counts.inspected,4);
  assert.equal(r.news.counts.ignored_rows,3);
  assert.deepEqual(r.news.alerts,[{id:5,flags:['missing_publication','missing_discovery']}]);
  assert.equal(JSON.stringify(r).includes('secret-key'),false);
});

test('requires explicit valid clock and bounded arrays', () => {
  assert.throws(()=>auditDateProvenance({}),TypeError);
  assert.throws(()=>auditDateProvenance({asOf:'2026-11-40'}),TypeError);
  assert.throws(()=>auditDateProvenance({asOf,newsItems:{}}),TypeError);
});
