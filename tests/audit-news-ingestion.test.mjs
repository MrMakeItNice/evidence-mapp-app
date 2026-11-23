import test from 'node:test';
import assert from 'node:assert/strict';
import { auditNewsIngestion } from '../scripts/audit-news-ingestion.mjs';

function sample() {
  const x = {
    as_of: '2026-11-23T02:20:00Z',
    news_items: [
      {id:1,topic_id:1,source_url:'https://news.google.com/rss/articles/ABC?oc=5',publisher:'Google News',published_at:null,discovered_at:'2026-11-23T01:20:00Z',review_status:'pending',headline:'SECRET HEADLINE'},
      {id:2,topic_id:1,source_url:'https://agency.gov/document?id=2',publisher:'Agency',published_at:'2026-11-23T00:49:22+00:00',discovered_at:'2026-11-23T01:00:00Z',review_status:'pending'}
    ],
    research_inbox:[{id:10,source_url:'https://news.google.com/rss/articles/ABC?oc=5',published_at:null,review_status:'pending',watch_topic_id:null,related_case_id:null,notes:'SECRET NOTE'}],
    sources:[{id:20,url:'https://agency.gov/document?id=2',published:true,publication_date:null}],
    news_topics:[{id:1,active:true},{id:2,active:true}],
    research_watch_topics:[{id:1,active:true,last_checked_at:null}],
    news_watch_topics:[{id:1,active:true,last_collected_at:'2026-11-20T00:00:00Z'}],
    agent_control_feeds:[{feed_id:1,active:true,last_success_at:'2026-11-23T01:00:00Z'}]
  };
  x.expected_counts = Object.fromEntries(Object.entries(x)
    .filter(([,value])=>Array.isArray(value)).map(([name,value])=>[name,value.length]));
  return x;
}

test('audits ingestion and does not treat UTC midnight as a future timestamp',()=>{
  const x=auditNewsIngestion(sample());
  assert.equal(x.news.total,2);
  assert.equal(x.news.missing_publication_timestamp,1);
  assert.equal(x.news.missing_publication_timestamp_google_proxies,1);
  assert.equal(x.news.publication_timestamps_after_snapshot_time,0);
  assert.equal(x.news.discovered_last_24h,2);
  assert.equal(x.news.active_topics_without_direct_items,1);
  assert.equal(x.inbox.without_watch_topic,1);
  assert.equal(x.inbox.without_related_case,1);
  assert.equal(x.overlap.news_inbox_exact_url_rows,1);
  assert.equal(x.overlap.news_source_exact_url_rows,1);
  assert.equal(x.sources.published_marked_missing_date,1);
  assert.equal(x.watches.stale_research_timestamp_fields,1);
  assert.equal(x.watches.stale_news_timestamp_fields,1);
  assert.equal(x.watches.collectors_without_success_in_24h,0);
});

test('future publication timestamps use exact instants and produce IDs only',()=>{
  const s=sample();s.news_items[1].published_at='2026-11-23T02:30:00Z';
  const x=auditNewsIngestion(s);
  assert.deepEqual(x.news.future_published_item_ids,[2]);
  assert.equal(x.news.publication_timestamps_after_snapshot_time,1);
  assert.ok(!JSON.stringify(x).includes('SECRET'));
  assert.ok(!JSON.stringify(x).includes('https://'));
});

test('query parameters distinguish separate documents in deduplication',()=>{
  const s=sample();s.news_items[1].source_url='https://agency.gov/document?id=1';
  s.news_items.push({id:3,topic_id:2,source_url:'https://agency.gov/document?id=2',published_at:null});
  s.expected_counts.news_items=3;
  assert.equal(auditNewsIngestion(s).news.exact_url_duplicate_groups,0);
});

test('exact same-table duplicate groups are separate from cross-table overlaps',()=>{
  const s=sample();
  s.news_items.push({id:3,topic_id:1,source_url:s.news_items[0].source_url,published_at:null});
  s.expected_counts.news_items=3;
  const x=auditNewsIngestion(s);
  assert.equal(x.news.exact_url_duplicate_groups,1);
  assert.equal(x.overlap.news_inbox_exact_url_rows,2);
});

test('refuses incomplete snapshots and duplicate record IDs',()=>{
  const s=sample();s.expected_counts.news_items=3;
  assert.throws(()=>auditNewsIngestion(s),/Incomplete news_items/);
  s.expected_counts.news_items=2;s.news_items[1].id=1;
  assert.throws(()=>auditNewsIngestion(s),/Invalid news_items ID/);
});

test('stale watch fields do not automatically imply a stalled collector',()=>{
  const s=sample();s.agent_control_feeds[0].last_success_at='2026-11-19T01:00:00Z';
  const x=auditNewsIngestion(s);
  assert.equal(x.watches.stale_research_timestamp_fields,1);
  assert.equal(x.watches.collectors_without_success_in_24h,1);
});

test('invalid dates fail rather than silently misclassifying the source',()=>{
  const s=sample();s.news_items[1].published_at='not a date';
  assert.throws(()=>auditNewsIngestion(s),/Invalid timestamp/);
});


test('separates non-Google undated records for targeted review without leaking titles',()=>{
  const s=sample();
  s.news_items.push({id:3,topic_id:2,source_url:'https://agency.gov/article?id=3',publisher:'Agency',
    published_at:null,headline:'SECRET PRIVATE STORY',review_status:'pending'});
  s.expected_counts.news_items=3;
  const a=auditNewsIngestion(s);
  assert.equal(a.news.missing_publication_timestamp_other,1);
  assert.deepEqual(a.news.undated_other_item_ids,[3]);
  assert.deepEqual(a.news.empty_active_topic_ids,[]);
  assert.ok(!JSON.stringify(a).includes('SECRET PRIVATE STORY'));
  assert.ok(!JSON.stringify(a).includes('agency.gov'));
});

test('caps non-Google undated IDs and keeps deterministic ascending order',()=>{
  const s=sample();
  for(let id=32;id>=3;id--) s.news_items.push({id,topic_id:1,source_url:'https://agency.gov/item?id='+id,
    publisher:'Agency',published_at:null});
  s.expected_counts.news_items=32;
  const a=auditNewsIngestion(s);
  assert.equal(a.news.missing_publication_timestamp_other,30);
  assert.equal(a.news.undated_other_item_ids.length,25);
  assert.equal(a.news.undated_other_item_ids[0],3);
  assert.equal(a.news.omitted_undated_other_item_ids,5);
  assert.deepEqual(a.news.empty_active_topic_ids,[2]);
});

test('refuses an unknown research inbox watch-topic reference',()=>{
  const s=sample();s.research_inbox[0].watch_topic_id=999;
  assert.throws(()=>auditNewsIngestion(s),/Unknown inbox watch topic/);
  s.research_inbox[0].watch_topic_id=1;
  assert.equal(auditNewsIngestion(s).inbox.without_watch_topic,0);
});

test('counts missing published-source publisher independently of missing date',()=>{
  const s=sample();
  assert.equal(auditNewsIngestion(s).sources.published_marked_missing_publisher,1);
  s.sources[0].publisher='Agency';
  assert.equal(auditNewsIngestion(s).sources.published_marked_missing_publisher,0);
});
