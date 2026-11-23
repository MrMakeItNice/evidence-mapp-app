/** Read-only, accessible source inspection for reviewed geographic events. */
const CATEGORIES = new Set(['positive', 'negative', 'neutral']);

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function safeSourceUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url : null;
  } catch { return null; }
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
        Math.abs(event.lon) > 180 || typeof event.location_note !== 'string' ||
        !event.location_note.trim()) continue;
    // Review status alone cannot establish where a story happened. Require
    // a separately inspectable basis for the map placement (which may be
    // the same document as the original event citation).
    const url = safeSourceUrl(event.source_url);
    const locationUrl = safeSourceUrl(event.location_source_url);
    if (!url || !locationUrl) continue;
    seen.add(event.id);
    result.push({id: event.id, title: event.title.trim(), category: event.category,
      event_date: event.event_date, lat: event.lat, lon: event.lon,
      source_url: url.href, source_host: url.hostname,
      location_source_url: locationUrl.href, location_source_host: locationUrl.hostname,
      location_note: event.location_note.trim()});
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
  const mapNote = doc.createElement('p');
  mapNote.textContent = 'Map placement: ' + event.location_note +
    ' · Location evidence host: ' + event.location_source_host +
    '. Coordinates reflect an editorial placement, not independently verified GPS precision.';
  const locationLink = doc.createElement('a');
  locationLink.href = event.location_source_url;
  locationLink.target = '_blank';
  locationLink.rel = 'noopener noreferrer';
  locationLink.textContent = 'Inspect map location evidence';
  panel.append(heading, context, link, mapNote, locationLink);
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
