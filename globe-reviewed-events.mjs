/** Read-only, accessible source inspection for reviewed geographic events. */
const CATEGORIES = new Set(['positive', 'negative', 'neutral']);

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function reviewedMapEvents(events) {
  if (!Array.isArray(events)) return [];
  const seen = new Set();
  const result = [];
  for (const event of events) {
    if (!event || event.review_status !== 'verified' || typeof event.id !== 'string' ||
        !event.id.trim() || seen.has(event.id) || typeof event.title !== 'string' ||
        !event.title.trim() || !CATEGORIES.has(event.category) ||
        !calendarDate(event.event_date) || !Number.isFinite(event.lat) ||
        !Number.isFinite(event.lon) || Math.abs(event.lat) > 90 ||
        Math.abs(event.lon) > 180 || typeof event.source_url !== 'string') continue;
    let url;
    try { url = new URL(event.source_url); } catch { continue; }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) continue;
    seen.add(event.id);
    result.push({id: event.id, title: event.title.trim(), category: event.category,
      event_date: event.event_date, lat: event.lat, lon: event.lon,
      source_url: url.href, source_host: url.hostname});
  }
  return result;
}

export function showReviewedMapSource(doc, panel, event) {
  panel.replaceChildren();
  const heading = doc.createElement('strong');
  heading.textContent = event.title;
  const context = doc.createElement('p');
  context.textContent = event.category + ' · Event: ' + event.event_date +
    ' · Source host: ' + event.source_host +
    '. This is an editorially reviewed event record; a link does not independently verify its claims.';
  const link = doc.createElement('a');
  link.href = event.source_url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Inspect original source';
  panel.append(heading, context, link);
}

export function renderReviewedMapList(doc, list, events, onInspect) {
  list.replaceChildren();
  const valid = reviewedMapEvents(events);
  for (const event of valid) {
    const item = doc.createElement('li');
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = 'Inspect ' + event.title;
    button.addEventListener('click', () => onInspect(event));
    const context = doc.createElement('small');
    context.textContent = event.event_date + ' · ' + event.source_host + ' · ' + event.category;
    item.append(button, context);
    list.append(item);
  }
  return valid;
}
