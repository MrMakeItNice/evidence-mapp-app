/** Read-only, accessible source inspection for reviewed geographic events. */
const CATEGORIES = new Set(['positive', 'negative', 'neutral']);
const LOCATION_ROLES = new Map([
  ['occurrence_site', 'Occurrence site'],
  ['archaeological_site_reference', 'Archaeological site reference (not an exact excavation or publication point)'],
  ['beneficiary_site', 'Beneficiary site (not necessarily the decision or activity venue)']
]);

function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function safeSourceUrl(value) {
  // Do not let browser URL repair turn malformed provenance into a new link.
  // Require an explicit authority, no raw whitespace/control characters or
  // backslashes, and no userinfo (including an empty @ prefix).
  if (typeof value !== 'string' || /[\s\u0000-\u001f\u007f\\]/.test(value)) return null;
  const authority = /^https:\/\/([^/?#]+)/i.exec(value);
  if (!authority || authority[1].includes('@')) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url : null;
  } catch { return null; }
}

// These optional links are indexed with the reviewed record, not separately vetted
// evidence. They must never determine map eligibility or count as extra events.
function collectIndexedUrls(values, destination) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    const url = safeSourceUrl(value);
    if (url && !destination.includes(url.href)) destination.push(url.href);
  }
}

// Preserve editorial corrections with the citation they were indexed under.
// These are record notes, not independently verified findings or location evidence.
function collectCorrection(event, sourceUrl, destination) {
  if (typeof event.correction_note !== 'string') return;
  const note = event.correction_note.trim();
  if (note && !destination.some(item => item.note === note && item.source_url === sourceUrl)) {
    destination.push({note, source_url: sourceUrl});
  }
}

// A source may date a report, approval or disclosure rather than the underlying
// physical activity. Retain the editorial date basis under its own citation;
// the note is context only, never a substitute for a valid event date or location.
function collectDateBasis(event, sourceUrl, destination) {
  if (typeof event.date_basis !== 'string') return;
  const note = event.date_basis.trim();
  if (note && !destination.some(item => item.note === note && item.source_url === sourceUrl)) {
    destination.push({note, source_url: sourceUrl});
  }
}

// Retain source-specific editorial limitations even when several reviewed
// citations describe one map event. Limitations never establish eligibility.
function collectSourceLimitation(event, sourceUrl, destination) {
  if (typeof event.source_limitation !== 'string') return;
  const note = event.source_limitation.trim();
  if (note && !destination.some(item => item.note === note && item.source_url === sourceUrl)) {
    destination.push({note, source_url: sourceUrl});
  }
}

// Classification is an editorial assessment, not a measure of global conditions.
function collectClassificationRationale(event, sourceUrl, destination) {
  if (typeof event.classification_rationale !== 'string') return;
  const note = event.classification_rationale.trim();
  if (note && !destination.some(item => item.note === note && item.source_url === sourceUrl)) {
    destination.push({note, source_url: sourceUrl});
  }
}

// An archive/document identifier belongs to its own citation, not to all sources.
function collectSourceRecordId(event, sourceUrl, destination) {
  if (typeof event.source_record_id !== 'string') return;
  const identifier = event.source_record_id.trim();
  if (identifier && !destination.some(item => item.identifier === identifier && item.source_url === sourceUrl)) {
    destination.push({identifier, source_url: sourceUrl});
  }
}

export function reviewedMapEvents(events, asOfMs = Date.now()) {
  if (!Array.isArray(events)) return [];
  // A verified *occurrence* cannot be dated beyond the current calendar day
  // anywhere on Earth. UTC+14 is the earliest civil timezone; using the UTC
  // date alone would wrongly withhold events already occurring there.
  const latestPossibleEventDate = new Date(asOfMs + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // A single canonical ID with inconsistent position, date, category, or location provenance
  // must not select an arbitrary first-seen map pin or marker color.
  const seen = new Map();
  const conflictingDetails = new Set();
  const result = [];
  for (const event of events) {
    // Normalize stable IDs before comparing: whitespace must not produce duplicate pins.
    const id = typeof event?.id === 'string' ? event.id.trim() : '';
    if (!event || event.review_status !== 'verified' || !id ||
        typeof event.title !== 'string' ||
        !event.title.trim() || !CATEGORIES.has(event.category) || !LOCATION_ROLES.has(event.location_role) ||
        (!calendarDate(event.event_date) || event.event_date > latestPossibleEventDate) || !Number.isFinite(event.lat) ||
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
          previous.event_date !== event.event_date || previous.category !== event.category ||
          previous.location_role !== event.location_role ||
          previous.location_note !== event.location_note.trim() ||
          previous.location_source_url !== locationUrl.href) {
        conflictingDetails.add(id);
      }
      // Keep alternate reviewed event citations inspectable without counting
      // them as new occurrences or independent corroboration.
      if (url.href !== previous.source_url && !previous.alternate_sources.some(source => source.url === url.href)) {
        previous.alternate_sources.push({url: url.href, title: event.title.trim()});
      }
      collectIndexedUrls(event.additional_source_urls, previous.additional_source_urls);
      collectIndexedUrls(event.counterevidence_urls, previous.counterevidence_urls);
      collectCorrection(event, url.href, previous.correction_notes);
      collectDateBasis(event, url.href, previous.date_basis_notes);
      collectSourceLimitation(event, url.href, previous.source_limitations);
      collectClassificationRationale(event, url.href, previous.classification_rationales);
      collectSourceRecordId(event, url.href, previous.source_record_ids);
      continue;
    }
    const alternateSources = [];
    const additionalSourceUrls = [];
    const counterevidenceUrls = [];
    const correctionNotes = [];
    const dateBasisNotes = [];
    const sourceLimitations = [];
    const classificationRationales = [];
    const sourceRecordIds = [];
    collectSourceRecordId(event, url.href, sourceRecordIds);
    collectClassificationRationale(event, url.href, classificationRationales);
    collectSourceLimitation(event, url.href, sourceLimitations);
    collectDateBasis(event, url.href, dateBasisNotes);
    collectCorrection(event, url.href, correctionNotes);
    collectIndexedUrls(event.additional_source_urls, additionalSourceUrls);
    collectIndexedUrls(event.counterevidence_urls, counterevidenceUrls);
    seen.set(id, {source_url: url.href, alternate_sources: alternateSources, additional_source_urls: additionalSourceUrls, counterevidence_urls: counterevidenceUrls, correction_notes: correctionNotes, date_basis_notes: dateBasisNotes, source_limitations: sourceLimitations, classification_rationales: classificationRationales, source_record_ids: sourceRecordIds, lat: event.lat, lon: event.lon, event_date: event.event_date,
      category: event.category, location_role: event.location_role, location_note: event.location_note.trim(),
      location_source_url: locationUrl.href});
    // URL fragments may point to different pages of the *same* document.
    // Host matching alone is not sufficient to identify a reused citation.
    const locationCitesSameDocument = url.origin === locationUrl.origin &&
      url.pathname === locationUrl.pathname && url.search === locationUrl.search;
    result.push({id, title: event.title.trim(), category: event.category,
      event_date: event.event_date, lat: event.lat, lon: event.lon,
      source_url: url.href, source_host: url.hostname, alternate_sources: alternateSources,
      additional_source_urls: additionalSourceUrls, counterevidence_urls: counterevidenceUrls, correction_notes: correctionNotes, date_basis_notes: dateBasisNotes, source_limitations: sourceLimitations, classification_rationales: classificationRationales, source_record_ids: sourceRecordIds,
      location_source_url: locationUrl.href, location_source_host: locationUrl.hostname,
      location_cites_same_document: locationCitesSameDocument,
      location_role: event.location_role, location_role_label: LOCATION_ROLES.get(event.location_role),
      location_note: event.location_note.trim()});
  }
  return result.filter(event => !conflictingDetails.has(event.id)).map(event => {
    const displayed = new Set([event.source_url, event.location_source_url,
      ...event.alternate_sources.map(source => source.url), ...event.counterevidence_urls]);
    return {...event, additional_source_urls: event.additional_source_urls.filter(url => !displayed.has(url))};
  });
}

/** Explain map eligibility separately from global Pulse coverage. */
export function reviewedMapAvailability(feedAvailable, candidateCount, mapCount) {
  if (!feedAvailable) return 'Reviewed map feed unavailable. Source-backed locations cannot be assessed.';
  if (candidateCount === 0) return 'The curated feed contains no event records yet. This is not a count of events worldwide.';
  if (mapCount === 0) return 'No event in this feed qualifies for a reviewed map point. Events may lack reviewed geographic evidence or have conflicting records; this does not mean no events occurred.';
  return mapCount + (mapCount === 1 ? ' reviewed map event is' : ' reviewed map events are') +
    ' available to inspect. Other feed records may not qualify for mapping; this is not global coverage.';
}

export function showReviewedMapSource(doc, panel, event) {
  panel.replaceChildren();
  const heading = doc.createElement('strong');
  heading.textContent = event.title;
  heading.setAttribute('role', 'heading');
  heading.setAttribute('aria-level', '3');
  const context = doc.createElement('p');
  context.textContent = 'Event ID: ' + event.id + ' · ' + event.category + ' · Event: ' + event.event_date +
    ' · Source host: ' + event.source_host +
    '. This is an editorially reviewed event record; a link does not independently verify its claims.' +
    (event.date_basis_notes?.length ?
      ' Indexed date basis (not necessarily the date of the underlying activity): ' +
        event.date_basis_notes.map(item => item.note + ' — Citation: ' + item.source_url).join('; ') :
      ' No separate date-basis note is indexed; consult the source before inferring when underlying activities occurred.');
  const link = doc.createElement('a');
  link.href = event.source_url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Inspect original source (opens in new tab): ' + event.source_url;
  const mapNote = doc.createElement('p');
  mapNote.textContent = 'Displayed map point: ' + event.lat + '° latitude, ' + event.lon + '° longitude. ' +
    'Location role: ' + event.location_role_label + ' · Map placement: ' + event.location_note +
    ' · Location evidence host: ' + event.location_source_host +
    '. Coordinates reflect an editorial placement, not independently verified GPS precision. ' +
    (event.location_cites_same_document ?
      'The location citation reuses the same document as the event source (possibly a different page), not independent corroboration.' :
      'A separate location-evidence URL does not by itself establish independent corroboration.');
  const locationLink = doc.createElement('a');
  locationLink.href = event.location_source_url;
  locationLink.target = '_blank';
  locationLink.rel = 'noopener noreferrer';
  locationLink.textContent = 'Inspect map location evidence (opens in new tab): ' + event.location_source_url;
  panel.append(heading, context, link, mapNote, locationLink);
  if (event.source_record_ids?.length) {
    const note = doc.createElement('p');
    note.textContent = 'Indexed document identifiers: use these to locate the cited records. Identifiers are editorial metadata, not independent verification or geographic evidence.';
    const records = doc.createElement('ul');
    for (const record of event.source_record_ids) {
      const item = doc.createElement('li');
      item.textContent = record.identifier + ' — Indexed under event citation: ' + record.source_url;
      records.append(item);
    }
    panel.append(note, records);
  }
  if (event.alternate_sources?.length) {
    const note = doc.createElement('p');
    note.textContent = 'Other reviewed citations indexed under the same event ID; these are not additional events or established independent corroboration.';
    const sources = doc.createElement('ul');
    for (const source of event.alternate_sources) {
      const item = doc.createElement('li');
      const anchor = doc.createElement('a');
      anchor.href = source.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = 'Inspect alternate event citation (opens in new tab): ' + source.title + ' — ' + source.url;
      item.append(anchor);
      sources.append(item);
    }
    panel.append(note, sources);
  }
  if (event.additional_source_urls?.length) {
    const note = doc.createElement('p');
    note.textContent = 'Additional indexed source links: individual review and independent corroboration are not established. These links do not establish map placement.';
    const sources = doc.createElement('ul');
    for (const url of event.additional_source_urls) {
      const item = doc.createElement('li');
      const anchor = doc.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = 'Inspect additional indexed link (opens in new tab): ' + url;
      item.append(anchor);
      sources.append(item);
    }
    panel.append(note, sources);
  }
  if (event.counterevidence_urls?.length) {
    const note = doc.createElement('p');
    note.textContent = 'Indexed counterevidence or competing interpretations: inspect these links before drawing conclusions. Individual review, independence and whether they contradict the event are not established. These links do not establish map placement.';
    const sources = doc.createElement('ul');
    for (const url of event.counterevidence_urls) {
      const item = doc.createElement('li');
      const anchor = doc.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = 'Inspect indexed counterevidence (opens in new tab): ' + url;
      item.append(anchor);
      sources.append(item);
    }
    panel.append(note, sources);
  }
  if (event.source_limitations?.length) {
    const note = doc.createElement('p');
    note.textContent = 'Indexed source limitations: these editorial notes describe gaps or uncertainties, not independent findings. They do not establish map placement.';
    const limitations = doc.createElement('ul');
    for (const limitation of event.source_limitations) {
      const item = doc.createElement('li');
      item.textContent = limitation.note + ' — Indexed under event citation: ' + limitation.source_url;
      limitations.append(item);
    }
    panel.append(note, limitations);
  }
  if (event.classification_rationales?.length) {
    const note = doc.createElement('p');
    note.textContent = 'Indexed editorial classification rationale: category labels are provisional assessments of this event, not independent findings or measures of global conditions. They do not establish map placement.';
    const rationales = doc.createElement('ul');
    for (const rationale of event.classification_rationales) {
      const item = doc.createElement('li');
      item.textContent = rationale.note + ' — Indexed under event citation: ' + rationale.source_url;
      rationales.append(item);
    }
    panel.append(note, rationales);
  }
  if (event.correction_notes?.length) {
    const note = doc.createElement('p');
    note.textContent = 'Indexed editorial correction notes: read these before relying on the event summary. They are not independent findings and do not establish map placement.';
    const corrections = doc.createElement('ul');
    for (const correction of event.correction_notes) {
      const item = doc.createElement('li');
      item.textContent = correction.note + ' — Indexed under event citation: ' + correction.source_url;
      corrections.append(item);
    }
    panel.append(note, corrections);
  }
}


/** Present list selections in a readable, keyboard-reachable detail region. */
export function inspectReviewedMapSource(doc, detail, event, returnFocusTo, compactPanel) {
  // The compact globe readout is a live status region, not a second evidence panel.
  // Keep its announcement brief and leave all inspectable citations in the focused
  // full-width detail, so long source notes cannot cover the globe or be read twice.
  if (compactPanel) {
    compactPanel.replaceChildren();
    compactPanel.textContent = 'Selected reviewed map event: ' + event.title + ' (' + event.id + ') · ' +
      event.event_date + ' · ' + event.category + '. Location role: ' + event.location_role_label +
      '. Original sources and map placement evidence are in the selected event detail below.';
  }
  showReviewedMapSource(doc, detail, event);
  // Focus enters this named region, so identify the current event even when
  // several list entries have identical titles. Keep the label literal text.
  detail.setAttribute('aria-label', 'Selected map event source and location evidence: ' + event.title + ' (Event ID: ' + event.id + ')');
  if (returnFocusTo) {
    const close = () => {
      detail.hidden = true;
      detail.replaceChildren();
      detail.onkeydown = null;
      if (compactPanel) {
        compactPanel.replaceChildren();
        compactPanel.textContent = 'No reviewed event selected. Choose a map marker or an event in the source list.';
      }
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
  // Visible names must distinguish identical-looking titles for keyboard,
  // screen-reader button lists and voice-control users, not just descriptions.
  const titleKey = title => title.replace(/\s+/g, ' ').toLowerCase();
  const titleCounts = new Map();
  for (const event of valid) {
    const key = titleKey(event.title);
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
  }
  for (const event of valid) {
    const item = doc.createElement('li');
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = 'Inspect ' + event.title +
      (titleCounts.get(titleKey(event.title)) > 1 ? ' (Event ID: ' + event.id + ')' : '');
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
    // Announce both provenance roles when a keyboard user focuses the event.
    // These hosts may coincide; they are not independent corroboration.
    context.id = 'reviewed-globe-event-context-' + buttons.length;
    context.textContent = 'Event ID: ' + event.id + ' · ' + event.event_date +
      ' · Location role: ' + event.location_role_label + ' · Map placement: ' + event.location_note + ' · Event source: ' + event.source_host +
      ' · Location evidence: ' + event.location_source_host + ' · ' + event.category +
      (event.location_cites_same_document ?
        ' · Same document used for both citations; not independent corroboration' :
        ' · Distinct citation URL; independence not established') +
      (event.source_record_ids.length ? ' · ' + event.source_record_ids.length + ' indexed document identifier(s); inspect to locate original records' : '') +
      (event.alternate_sources.length ? ' · ' + event.alternate_sources.length + ' additional indexed event citation(s); independence not established' : '') +
      (event.additional_source_urls.length ? ' · ' + event.additional_source_urls.length + ' supplemental indexed link(s); individual review not established' : '') +
      (event.counterevidence_urls.length ? ' · ' + event.counterevidence_urls.length + ' indexed counterevidence link(s); individual review not established' : '') +
      (event.date_basis_notes.length ? ' · ' + event.date_basis_notes.length + ' indexed date-basis note(s); inspect before inferring activity dates' : '') +
      (event.source_limitations.length ? ' · ' + event.source_limitations.length + ' indexed source limitation(s); inspect before drawing conclusions' : '') +
      (event.classification_rationales.length ? ' · ' + event.classification_rationales.length + ' indexed editorial classification rationale(s); category is a provisional assessment' : ' · No separate editorial classification rationale is indexed') +
      (event.correction_notes.length ? ' · ' + event.correction_notes.length + ' indexed editorial correction note(s); inspect before relying on summary' : '');
    button.setAttribute('aria-describedby', context.id);
    item.append(button, context);
    list.append(item);
  }
  return valid;
}
