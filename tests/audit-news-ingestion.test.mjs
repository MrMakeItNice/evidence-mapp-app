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

test('triages aged inbox items with numeric IDs only',()=>{
  const s=sample();
  s.research_inbox[0].discovered_at='2026-10-01T00:00:00Z';
  const report=auditNewsIngestion(s);
  assert.equal(report.inbox.pending_over_14d,1);
  assert.deepEqual(report.inbox.old_pending_item_ids,[10]);
  assert.equal(report.inbox.omitted_old_pending_item_ids,0);
  assert.ok(!JSON.stringify(report).includes('SECRET NOTE'));
});

test('does not count recent or non-pending inbox items as aged',()=>{
  const s=sample();
  s.research_inbox[0].discovered_at='2026-11-22T12:00:00Z';
  assert.equal(auditNewsIngestion(s).inbox.pending_over_14d,0);
  s.research_inbox[0].discovered_at='2026-10-01T00:00:00Z';
  s.research_inbox[0].review_status='reviewed';
  assert.equal(auditNewsIngestion(s).inbox.pending_over_14d,0);
});

test('flags malformed links but never prints raw URLs or credentials',()=>{
  const s=sample();
  s.news_items[0].source_url='ftp://agency.gov/NOT_PUBLIC';
  s.news_items[1].source_url='https://user:secret@agency.gov/doc';
  s.research_inbox[0].source_url='https://bad url.example';
  s.sources[0].url=null;
  const report=auditNewsIngestion(s);
  assert.equal(report.news.malformed_url,2);
  assert.deepEqual(report.news.malformed_url_item_ids,[1,2]);
  assert.equal(report.inbox.malformed_url,1);
  assert.equal(report.sources.missing_url,1);
  assert.equal(report.sources.malformed_url,0);
  assert.ok(!JSON.stringify(report).includes('secret'));
  assert.ok(!JSON.stringify(report).includes('NOT_PUBLIC'));
});

test('preserves document query strings and ignores unpublished source link problems',()=>{
  const s=sample();
  s.news_items[1].source_url='https://agency.gov/document?id=A%20B';
  s.sources.push({id:21, published:false, url:'javascript:doSomething()'});
  s.expected_counts.sources=2;
  const report=auditNewsIngestion(s);
  assert.equal(report.news.malformed_url,0);
  assert.equal(report.sources.malformed_url,0);
  assert.equal(report.sources.missing_url,0);
});


test('classifies latest collector error with a recent earlier success as intermittent',()=>{
  const s=sample();
  s.agent_control_feeds[0].last_run_status='error';
  s.agent_control_feeds[0].name='PRIVATE FEED NAME';
  const w=auditNewsIngestion(s).watches;
  assert.equal(w.collectors_latest_error_with_recent_success,1);
  assert.deepEqual(w.latest_error_recent_success_feed_ids,[1]);
  assert.equal(w.collectors_latest_error_without_recent_success,0);
  assert.ok(!JSON.stringify(w).includes('PRIVATE FEED NAME'));
});

test('classifies latest collector error with stale success separately',()=>{
  const s=sample();
  s.agent_control_feeds[0].last_run_status='failed';
  s.agent_control_feeds[0].last_success_at='2026-11-19T01:00:00Z';
  const w=auditNewsIngestion(s).watches;
  assert.equal(w.collectors_latest_error_with_recent_success,0);
  assert.equal(w.collectors_latest_error_without_recent_success,1);
  assert.deepEqual(w.latest_error_without_recent_success_feed_ids,[1]);
  assert.equal(w.collectors_without_success_in_24h,1);
});

test('latest successful collector state clears error triage even when watch timestamp is stale',()=>{
  const s=sample();
  s.agent_control_feeds[0].last_run_status='ok';
  const w=auditNewsIngestion(s).watches;
  assert.equal(w.collectors_latest_error_with_recent_success,0);
  assert.equal(w.collectors_latest_error_without_recent_success,0);
  assert.equal(w.stale_news_timestamp_fields,1);
});


test('returns numeric-only cross-collection candidates without exposing research content',()=>{
  const report=auditNewsIngestion(sample());
  assert.deepEqual(report.overlap.news_inbox_exact_url_id_pairs,[[1,10]]);
  assert.deepEqual(report.overlap.news_source_exact_url_id_pairs,[[2,20]]);
  assert.equal(report.overlap.news_inbox_omitted_id_pairs,0);
  assert.equal(report.overlap.news_source_omitted_id_pairs,0);
  assert.ok(!JSON.stringify(report).includes('SECRET HEADLINE'));
  assert.ok(!JSON.stringify(report).includes('news.google.com'));
  assert.ok(!JSON.stringify(report).includes('agency.gov'));
});

test('sorts cross-collection candidate IDs and preserves query-specific document identities',()=>{
  const s=sample();
  s.news_items.push({id:40,topic_id:2,source_url:s.news_items[0].source_url});
  s.news_items.push({id:3,topic_id:2,source_url:s.news_items[1].source_url});
  s.research_inbox.push({id:11,source_url:s.news_items[1].source_url});
  s.sources.push({id:21,url:'https://agency.gov/document?id=3',published:true});
  s.expected_counts.news_items=4;
  s.expected_counts.research_inbox=2;
  s.expected_counts.sources=2;
  const overlap=auditNewsIngestion(s).overlap;
  assert.deepEqual(overlap.news_inbox_exact_url_id_pairs,[[1,10],[2,11],[3,11],[40,10]]);
  assert.deepEqual(overlap.news_source_exact_url_id_pairs,[[2,20],[3,20]]);
  assert.equal(overlap.news_source_exact_url_rows,2);
});

test('caps numeric-only cross-collection candidate IDs with omission counts',()=>{
  const s=sample();
  for(let id=129;id>=100;id--) s.news_items.push({id,topic_id:1,source_url:s.news_items[0].source_url});
  s.expected_counts.news_items=32;
  const overlap=auditNewsIngestion(s).overlap;
  assert.equal(overlap.news_inbox_exact_url_rows,31);
  assert.equal(overlap.news_inbox_exact_url_id_pairs.length,25);
  assert.deepEqual(overlap.news_inbox_exact_url_id_pairs[0],[1,10]);
  assert.deepEqual(overlap.news_inbox_exact_url_id_pairs[24],[123,10]);
  assert.equal(overlap.news_inbox_omitted_id_pairs,6);
});


test('flags exact-link publisher labels and publication times only as review candidates',()=> {
  const s=sample();
  s.news_items[0].published_at='2026-11-22T01:00:00Z';
  s.research_inbox[0].publisher='Different outlet';
  s.research_inbox[0].published_at='2026-11-23T02:00:00Z';
  const review=auditNewsIngestion(s).overlap.news_inbox_metadata_review;
  assert.equal(review.publisher_label_difference_pairs,1);
  assert.deepEqual(review.publisher_label_difference_id_pairs,[[1,10]]);
  assert.equal(review.publication_times_over_24h_apart_pairs,1);
  assert.deepEqual(review.publication_times_over_24h_apart_id_pairs,[[1,10]]);
  assert.equal(review.omitted_publication_time_difference_id_pairs,0);
  assert.ok(!JSON.stringify(review).includes('Different outlet'));
  assert.ok(!JSON.stringify(review).includes('news.google.com'));
});

test('normalizes harmless publisher capitalization and spacing, uses exact instants, and excludes malformed links',()=> {
  const s=sample();
  s.news_items[0].published_at='2026-11-22T03:00:00Z';
  s.research_inbox[0].publisher='  GOOGLE   NEWS ';
  s.research_inbox[0].published_at='2026-11-23T02:00:00Z';
  let review=auditNewsIngestion(s).overlap.news_inbox_metadata_review;
  assert.equal(review.publisher_label_difference_pairs,0);
  assert.equal(review.publication_times_over_24h_apart_pairs,0);
  s.news_items[0].source_url='ftp://not-credible.example/doc';
  s.research_inbox[0].source_url='ftp://not-credible.example/doc';
  s.research_inbox[0].publisher='Unrelated';
  review=auditNewsIngestion(s).overlap.news_inbox_metadata_review;
  assert.equal(review.publisher_label_difference_pairs,0);
  assert.equal(review.publication_times_over_24h_apart_pairs,0);
});

test('audits inbox/source identity as a third cross-collection path without automatic linking',()=> {
  const s=sample();
  s.research_inbox[0].source_url=s.sources[0].url;
  const overlap=auditNewsIngestion(s).overlap;
  assert.equal(overlap.inbox_source_exact_url_rows,1);
  assert.deepEqual(overlap.inbox_source_exact_url_id_pairs,[[10,20]]);
  assert.equal(overlap.inbox_source_omitted_id_pairs,0);
});

test('caps and sorts numeric-only metadata discrepancy pairs',()=> {
  const s=sample();
  s.news_items[0].published_at='2026-11-21T00:00:00Z';
  for(let id=50;id>=21;id--) s.research_inbox.push({id,source_url:s.news_items[0].source_url,
    publisher:'Different organization',published_at:'2026-11-23T01:00:00Z'});
  s.expected_counts.research_inbox=s.research_inbox.length;
  const review=auditNewsIngestion(s).overlap.news_inbox_metadata_review;
  assert.equal(review.publisher_label_difference_pairs,30);
  assert.equal(review.publication_times_over_24h_apart_pairs,30);
  assert.deepEqual(review.publisher_label_difference_id_pairs[0],[1,21]);
  assert.deepEqual(review.publication_times_over_24h_apart_id_pairs[24],[1,45]);
  assert.equal(review.omitted_publisher_label_difference_id_pairs,5);
  assert.equal(review.omitted_publication_time_difference_id_pairs,5);
  assert.ok(!JSON.stringify(review).includes('Different organization'));
});


test('one-sided news/source publication date identifies the missing side for human review',()=> {
  const s=sample();
  let review=auditNewsIngestion(s).overlap.news_source_publication_date_review;
  assert.equal(review.source_missing_news_dated.count,1);
  assert.deepEqual(review.source_missing_news_dated.id_pairs,[[2,20]]);
  assert.equal(review.news_missing_source_dated.count,0);
  s.sources[0].publication_date='2026-11-22';
  review=auditNewsIngestion(s).overlap.news_source_publication_date_review;
  assert.equal(review.source_missing_news_dated.count,0);
  s.news_items[1].published_at=null;
  review=auditNewsIngestion(s).overlap.news_source_publication_date_review;
  assert.deepEqual(review.news_missing_source_dated.id_pairs,[[2,20]]);
  assert.equal(review.source_missing_news_dated.count,0);
});

test('one-sided news/source publication date respects document queries and malformed URLs',()=> {
  const s=sample();
  s.news_items[1].published_at=null;
  s.sources[0].publication_date='2026-11-22';
  s.news_items[1].source_url='https://agency.gov/document?id=3';
  let review=auditNewsIngestion(s).overlap.news_source_publication_date_review;
  assert.equal(review.news_missing_source_dated.count,0);
  s.news_items[1].source_url='ftp://agency.gov/document?id=2';
  s.sources[0].url='ftp://agency.gov/document?id=2';
  review=auditNewsIngestion(s).overlap.news_source_publication_date_review;
  assert.equal(review.news_missing_source_dated.count,0);
});

test('one-sided date review emits sorted capped numeric IDs, not unpublished content or URLs',()=> {
  const s=sample();
  s.sources[0].publication_date='2026-11-22';
  for(let id=34;id>=3;id--) s.news_items.push({
    id, topic_id:1, source_url:s.sources[0].url, published_at:null,
    headline:'PRIVATE RESEARCH ITEM', review_status:'pending'
  });
  s.expected_counts.news_items=s.news_items.length;
  const x=auditNewsIngestion(s);
  const review=x.overlap.news_source_publication_date_review;
  assert.equal(review.news_missing_source_dated.count,32);
  assert.equal(review.news_missing_source_dated.id_pairs.length,25);
  assert.deepEqual(review.news_missing_source_dated.id_pairs[0],[3,20]);
  assert.deepEqual(review.news_missing_source_dated.id_pairs[24],[27,20]);
  assert.equal(review.news_missing_source_dated.omitted_id_pairs,7);
  assert.ok(!JSON.stringify(x).includes('PRIVATE RESEARCH ITEM'));
  assert.ok(!JSON.stringify(x).includes('agency.gov'));
});


test('identical malformed cross-collection URLs are not evidence of a shared source',()=> {
  const s=sample();
  s.news_items[0].source_url='ftp://not-a-source.example/PRIVATE';
  s.research_inbox[0].source_url=s.news_items[0].source_url;
  s.news_items[1].source_url='https://username:password@agency.gov/doc?item=2';
  s.sources[0].url=s.news_items[1].source_url;
  const result=auditNewsIngestion(s);
  assert.equal(result.news.malformed_url,2);
  assert.equal(result.inbox.malformed_url,1);
  assert.equal(result.sources.malformed_url,1);
  assert.equal(result.overlap.news_inbox_exact_url_rows,0);
  assert.equal(result.overlap.news_source_exact_url_rows,0);
  assert.deepEqual(result.overlap.news_inbox_exact_url_id_pairs,[]);
  assert.deepEqual(result.overlap.news_source_exact_url_id_pairs,[]);
  assert.equal(result.overlap.news_source_publication_date_review.source_missing_news_dated.count,0);
  assert.ok(!JSON.stringify(result).includes('password'));
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});

test('identical invalid URLs are counted as malformed, not exact duplicate groups',()=> {
  const s=sample();
  s.news_items[0].source_url='javascript:NOT_PUBLIC';
  s.news_items.push({id:3,topic_id:2,source_url:s.news_items[0].source_url,published_at:null});
  s.expected_counts.news_items=3;
  const report=auditNewsIngestion(s);
  assert.equal(report.news.malformed_url,2);
  assert.equal(report.news.exact_url_duplicate_groups,0);
  assert.equal(report.overlap.news_inbox_exact_url_rows,0);
  assert.ok(!JSON.stringify(report).includes('NOT_PUBLIC'));
});
