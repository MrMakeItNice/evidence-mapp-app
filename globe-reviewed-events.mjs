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
  // A single canonical ID with inconsistent position, date, or editorial category
  // must not select an arbitrary first-seen map pin or marker color.
  const seen = new Map();
  const conflictingDetails = new Set();
  const result = [];
  for (const event of events) {
    // Normalize stable IDs before comparing: whitespace must not produce duplicate pins.
    const id = typeof event?.id === 'string' ? event.id.trim() : '';
    if (!event || event.review_status !== 'verified' || !id ||
        typeof event.title !== 'string' ||
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
    const previous = seen.get(id);
    if (previous) {
      if (previous.lat !== event.lat || previous.lon !== event.lon ||
          previous.event_date !== event.event_date || previous.category !== event.category) {
        conflictingDetails.add(id);
      }
      continue;
    }
    seen.set(id, {lat: event.lat, lon: event.lon, event_date: event.event_date, category: event.category});
    result.push({id, title: event.title.trim(), category: event.category,
      event_date: event.event_date, lat: event.lat, lon: event.lon,
      source_url: url.href, source_host: url.hostname,
      location_source_url: locationUrl.href, location_source_host: locationUrl.hostname,
      location_note: event.location_note.trim()});
  }
  return result.filter(event => !conflictingDetails.has(event.id));
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


/** Present list selections in a readable, keyboard-reachable detail region. */
export function inspectReviewedMapSource(doc, detail, event, returnFocusTo) {
  showReviewedMapSource(doc, detail, event);
  if (returnFocusTo) {
    const close = () => {
      detail.hidden = true;
      detail.replaceChildren();
      detail.onkeydown = null;
      returnFocusTo.setAttribute('aria-expanded', 'false');
      returnFocusTo.focus();
    };
    const back = doc.createElement('button');
    back.type = 'button';
    back.textContent = 'Back to map event list';
    back.addEventListener('click', close);
    // A fresh handler follows the current selection; never retain an old
    // event button when another source is inspected.
    detail.onkeydown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    detail.append(back);
  } else {
    detail.onkeydown = null;
  }
  detail.hidden = false;
  detail.focus(); // Move keyboard focus into the visible, inline provenance panel.
}

export function renderReviewedMapList(doc, list, events, onInspect) {
  list.replaceChildren();
  const valid = reviewedMapEvents(events);
  const buttons = [];
  for (const event of valid) {
    const item = doc.createElement('li');
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = 'Inspect ' + event.title;
    button.setAttribute('aria-controls', 'reviewed-globe-detail');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      for (const candidate of buttons) {
        candidate.setAttribute('aria-expanded', String(candidate === button));
      }
      onInspect(event, button);
    });
    buttons.push(button);
    const context = doc.createElement('small');
    context.textContent = event.event_date + ' · ' + event.source_host + ' · ' + event.category;
    item.append(button, context);
    list.append(item);
  }
  return valid;
}
