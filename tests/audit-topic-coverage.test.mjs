import assert from 'node:assert/strict';
import {test} from 'node:test';
import {auditTopicCoverage} from '../scripts/audit-topic-coverage.mjs';

test('identifies active empty topics without treating inactive topics as gaps',()=>{
  const r=auditTopicCoverage({topics:[{id:1,active:true},{id:2,active:true},{id:3,active:false}],newsItems:[{id:5,topic_id:1}]});
  assert.deepEqual(r.empty_active_topic_ids,[2]);
  assert.equal(r.active_topic_count,2);
});

test('separates null topic IDs from foreign references not in the snapshot',()=>{
  const r=auditTopicCoverage({topics:[{id:1,active:true}],newsItems:[{id:11,topic_id:null},{id:12,topic_id:33},{id:13,topic_id:1}]});
  assert.deepEqual(r.missing_topic_news_item_ids,[11]);
  assert.deepEqual(r.unknown_topic_news_item_ids,[12]);
  assert.deepEqual(r.empty_active_topic_ids,[]);
});

test('reports unlinked articles and invalid join rows separately',()=>{
  const r=auditTopicCoverage({topics:[{id:1}],articles:[{id:4},{id:5}],articleTopics:[{article_id:4,topic_id:1},{article_id:99,topic_id:1},{article_id:4,topic_id:88}]});
  assert.deepEqual(r.unlinked_article_ids,[5]);
  assert.deepEqual(r.orphan_article_link_ids,[99]);
  assert.deepEqual(r.orphan_topic_link_ids,[88]);
});

test('reports repeated join pairs but never invents relationships',()=>{
  const r=auditTopicCoverage({topics:[{id:1}],articles:[{id:3},{id:4}],articleTopics:[{article_id:3,topic_id:1},{article_id:3,topic_id:1}]});
  assert.deepEqual(r.duplicate_article_topic_links,[{article_id:3,topic_id:1}]);
  assert.deepEqual(r.unlinked_article_ids,[4]);
});

test('rejects malformed IDs, duplicated primary keys and malformed input arrays',()=>{
  assert.throws(()=>auditTopicCoverage({topics:{}}),TypeError);
  assert.throws(()=>auditTopicCoverage({topics:[{id:0}]}),TypeError);
  assert.throws(()=>auditTopicCoverage({topics:[{id:1},{id:1}]}),TypeError);
  assert.throws(()=>auditTopicCoverage({newsItems:[{id:1,topic_id:'1'}]}),TypeError);
  assert.throws(()=>auditTopicCoverage({articleTopics:[{article_id:-1,topic_id:2}]}),TypeError);
});

test('does not mutate input or reflect untrusted record text/URLs',()=>{
  const topics=Object.freeze([Object.freeze({id:1,active:true,title:'secret',url:'https://example.com/?token=private'})]);
  const items=Object.freeze([Object.freeze({id:2,topic_id:1,headline:'secret headline',source_url:'https://example.com/?token=private'})]);
  const output=JSON.stringify(auditTopicCoverage({topics,newsItems:items}));
  assert.equal(output.includes('private'),false);
  assert.equal(output.includes('secret'),false);
  assert.equal(items[0].headline,'secret headline');
});
