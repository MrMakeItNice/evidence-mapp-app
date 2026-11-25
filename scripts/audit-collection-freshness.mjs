/**
 * Offline, advisory-only freshness audit for research/news watches and feed runs.
 * Accepts a caller-provided JSON snapshot and clock. No database, network,
 * mutations, publication, or automated inference about source truthfulness.
 * Output contains counts and identifiers only, never feed error bodies or URLs.
 */

function timestampAge(timestamp, asOfMs) {
  if (timestamp == null || timestamp === '') return 'missing';
  if (typeof timestamp !== 'string') return 'invalid';
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return 'invalid';
  if (parsed > asOfMs + 60_000) return 'future';
  return asOfMs - parsed;
}

function describeWatches(watches, field, asOfMs, staleAfterMs) {
  const out = { active: 0, fresh_ids: [], stale_ids: [], missing_ids: [], invalid_ids: [], future_ids: [] };
  for (const watch of watches) {
    if (!watch || watch.active !== true) continue;
    out.active++;
    const age = timestampAge(watch[field], asOfMs);
    const bucket = age === 'missing' ? 'missing_ids' : age === 'future' ? 'future_ids' :
      age === 'invalid' ? 'invalid_ids' : age > staleAfterMs ? 'stale_ids' : 'fresh_ids';
    if (typeof watch.id === 'number' && Number.isSafeInteger(watch.id) ||
        typeof watch.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(watch.id)) {
      out[bucket].push(watch.id);
    }
  }
  return out;
}

export function auditCollectionFreshness({ researchWatches = [], newsWatches = [], feeds = [], asOf } = {}) {
  if (![researchWatches, newsWatches, feeds].every(Array.isArray)) {
    throw new TypeError('Expected researchWatches, newsWatches and feeds arrays.');
  }
  if (typeof asOf !== 'string' || !Number.isFinite(Date.parse(asOf))) {
    throw new TypeError('Explicit valid asOf timestamp required.');
  }
  const asOfMs = Date.parse(asOf);
  const research = describeWatches(researchWatches, 'last_checked_at', asOfMs, 7 * 86400_000);
  const news = describeWatches(newsWatches, 'last_collected_at', asOfMs, 7 * 86400_000);
  const collectors = {
    active: 0, healthy_names: [], error_names: [], pending_names: [],
    no_run_names: [], stale_success_names: [], invalid_timestamp_names: [], future_timestamp_names: []
  };
  for (const feed of feeds) {
    if (!feed || feed.active !== true) continue;
    collectors.active++;
    // Names are only copied when short and printable. Never copy errors/URLs.
    const name = typeof feed.name === 'string' && /^[\p{L}\p{N}\p{P}\p{Zs}]{1,100}$/u.test(feed.name)
      ? feed.name : '(unnamed feed)';
    const runAge = timestampAge(feed.last_run_at, asOfMs);
    if (runAge === 'missing') { collectors.no_run_names.push(name); continue; }
    if (runAge === 'invalid') { collectors.invalid_timestamp_names.push(name); continue; }
    if (runAge === 'future') { collectors.future_timestamp_names.push(name); continue; }
    // Latest status takes precedence; a past success cannot erase a recent error.
    if (feed.last_run_status === 'error') { collectors.error_names.push(name); continue; }
    if (feed.last_run_status !== 'ok') { collectors.pending_names.push(name); continue; }
    const successAge = timestampAge(feed.last_success_at, asOfMs);
    if (successAge === 'invalid') collectors.invalid_timestamp_names.push(name);
    else if (successAge === 'future') collectors.future_timestamp_names.push(name);
    else if (successAge === 'missing' || successAge > 24 * 3600_000) collectors.stale_success_names.push(name);
    else collectors.healthy_names.push(name); // A 0 saved count is still a successful poll.
  }
  return { as_of: asOf, research_watches: research, news_watches: news, feeds: collectors,
    assessment: 'Operational freshness only; not evidence quality or editorial approval.' };
}
