// Shared publication gate for both homepage evidence-pulse displays.
// Unreviewed drafts are ignored; malformed 'verified' records fail closed.
export function reviewedEventsFromFeed(feed) {
  if (!feed || feed.schema_version !== 1 || !Array.isArray(feed.events)) {
    throw new Error('Invalid reviewed-event feed');
  }
  const seen = new Set();
  const reviewed = [];
  for (const event of feed.events) {
    if (!event || event.review_status !== 'verified') continue;
    const validDate = typeof event.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.event_date) &&
      !Number.isNaN(Date.parse(event.event_date)) && new Date(event.event_date).toISOString().slice(0, 10) === event.event_date;
    let validSource = false;
    if (typeof event.source_url === 'string') {
      try {
        const parsed = new URL(event.source_url);
        validSource = parsed.protocol === 'https:' && !parsed.username && !parsed.password && !!parsed.hostname;
      } catch (_) { /* No public link for malformed URLs. */ }
    }
    if (typeof event.id !== 'string' || !event.id.trim() || seen.has(event.id) ||
        typeof event.title !== 'string' || !event.title.trim() ||
        !['positive', 'negative', 'neutral'].includes(event.category) ||
        !validDate || !validSource ||
        !Number.isFinite(event.lat) || Math.abs(event.lat) > 90 ||
        !Number.isFinite(event.lon) || Math.abs(event.lon) > 180) {
      throw new Error('Invalid or duplicate verified event');
    }
    seen.add(event.id);
    reviewed.push(event);
  }
  return reviewed;
}
