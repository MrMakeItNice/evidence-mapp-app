/**
 * Offline, advisory-only title matching between existing news rows and a
 * human-curated list of primary-source metadata. NEVER auto-link or publish.
 * Inputs are JSON-style arrays; this module never connects to a database or
 * network and intentionally excludes original URLs from its output.
 */

function normalized(text) {
  if (typeof text !== 'string') return '';
  return text.normalize('NFKC').toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function mainTitle(news) {
  const raw = typeof news.headline === 'string' ? news.headline.trim() : '';
  const publisher = typeof news.publisher === 'string'
    ? news.publisher.replace(/\s*\(via Google News\)\s*$/i, '').trim() : '';
  // Trim a provider suffix ONLY when it identifies the saved publisher.
  const suffix = raw.match(/^(.*?)\s+-\s+([^-]+)$/);
  if (suffix && publisher && normalized(suffix[2]) === normalized(publisher)) {
    return { title: suffix[1], kind: 'publisher_suffix_title' };
  }
  return { title: raw, kind: 'exact_title' };
}

function isIdentifier(id) {
  return (typeof id === 'number' && Number.isSafeInteger(id)) ||
    (typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id));
}

export function suggestSourceLinks(newsItems, curatedSources) {
  if (!Array.isArray(newsItems) || !Array.isArray(curatedSources)) {
    throw new TypeError('Expected newsItems and curatedSources arrays.');
  }
  const index = new Map();
  for (const item of curatedSources) {
    if (!item || !isIdentifier(item.id)) continue;
    const key = normalized(item.title);
    if (key.length < 45 || key.split(' ').length < 7) continue;
    const bucket = index.get(key) ?? [];
    bucket.push(item.id);
    index.set(key, bucket);
  }
  const suggestions = [];
  for (const news of newsItems) {
    if (!news || !isIdentifier(news.id)) continue;
    const { title, kind } = mainTitle(news);
    const matches = index.get(normalized(title)) ?? [];
    // An ambiguous title never becomes an automatic suggestion.
    if (matches.length === 1) {
      suggestions.push({ news_id: news.id, curated_source_id: matches[0],
        match_reason: kind, status: 'human_review_required' });
    }
  }
  return suggestions;
}
