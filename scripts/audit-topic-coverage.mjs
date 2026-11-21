/**
 * Evidence Atlas offline topic/link integrity audit, advisory only.
 * Expects a local caller-provided JSON snapshot. Outputs IDs and counts only:
 * no titles, source content, URLs, credentials or speculative topic links.
 * Never connects to a database or network; never modifies its inputs.
 */

function checkId(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(label + ' must be a positive safe integer');
  }
  return value;
}

function indexById(records, label) {
  const ids = new Set();
  for (const record of records) {
    if (!record || typeof record !== 'object') throw new TypeError(label + ': expected object');
    const id = checkId(record.id, label + '.id');
    if (ids.has(id)) throw new TypeError(label + ': duplicate ID');
    ids.add(id);
  }
  return ids;
}

function sorted(values) { return [...values].sort((a,b) => a-b); }

export function auditTopicCoverage({topics=[],newsItems=[],articles=[],articleTopics=[]}={}) {
  if (![topics, newsItems, articles, articleTopics].every(Array.isArray)) {
    throw new TypeError('Expected topics, newsItems, articles and articleTopics arrays');
  }
  const topicIds = indexById(topics, 'topics');
  indexById(newsItems, 'newsItems');
  const articleIds = indexById(articles, 'articles');
  const topicItemCount = new Map([...topicIds].map(id => [id,0]));
  const missingTopicItemIds = [];
  const unknownTopicItemIds = [];
  for (const item of newsItems) {
    if (item.topic_id == null) { missingTopicItemIds.push(item.id); continue; }
    const topicId = checkId(item.topic_id, 'newsItems.topic_id');
    if (!topicIds.has(topicId)) unknownTopicItemIds.push(item.id);
    else topicItemCount.set(topicId, topicItemCount.get(topicId) + 1);
  }
  const unlinkedArticles = new Set(articleIds);
  const invalidArticleIdLinks = [];
  const invalidTopicIdLinks = [];
  const duplicateArticleTopicLinks = [];
  const seen = new Set();
  for (const link of articleTopics) {
    if (!link || typeof link !== 'object') throw new TypeError('Invalid articleTopics record');
    const articleId = checkId(link.article_id, 'articleTopics.article_id');
    const topicId = checkId(link.topic_id, 'articleTopics.topic_id');
    if (!articleIds.has(articleId)) invalidArticleIdLinks.push(articleId);
    if (!topicIds.has(topicId)) invalidTopicIdLinks.push(topicId);
    if (!articleIds.has(articleId) || !topicIds.has(topicId)) continue;
    unlinkedArticles.delete(articleId);
    const pair = articleId + ':' + topicId;
    if (seen.has(pair)) duplicateArticleTopicLinks.push({article_id:articleId,topic_id:topicId});
    seen.add(pair);
  }
  return {
    topic_count:topics.length,
    active_topic_count: topics.filter(t=>t.active===true).length,
    empty_active_topic_ids:sorted(topics.filter(t=>t.active===true && topicItemCount.get(t.id)===0).map(t=>t.id)),
    news_item_count:newsItems.length,
    missing_topic_news_item_ids:sorted(missingTopicItemIds),
    unknown_topic_news_item_ids:sorted(unknownTopicItemIds),
    article_count:articles.length,
    article_topic_link_count:articleTopics.length,
    unlinked_article_ids:sorted(unlinkedArticles),
    orphan_article_link_ids:sorted(invalidArticleIdLinks),
    orphan_topic_link_ids:sorted(invalidTopicIdLinks),
    duplicate_article_topic_links:duplicateArticleTopicLinks,
    assessment:'Coverage and relational integrity only. Empty categories and unlinked records are not proof of missing research; no topic or causal connection is inferred.'
  };
}
