import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedMapEvents, showReviewedMapSource, renderReviewedMapList, inspectReviewedMapSource, reviewedMapAvailability} from '../globe-reviewed-events.mjs';
import {readFileSync} from 'node:fs';

const event = {id: 'archive-01', title: 'Reviewed documented event', category: 'neutral',
  event_date: '2024-02-29', lat: 37.7, lon: -122.4,
  source_url: 'https://archive.example.gov/report?id=12#p3',
  location_source_url: 'https://archive.example.gov/report?id=12#location',
  location_role: 'occurrence_site',
  location_note: 'Reported city center; approximate map position, not a street address',
  review_status: 'verified'};
const withChanges = changes => ({...event, ...changes});

function element(tag) {
  return {tag, children: [], listeners: {}, attributes: {},
    setAttribute(name, value) {this.attributes[name] = String(value);},
    getAttribute(name) {return this.attributes[name] ?? null;},
    replaceChildren(...children) {this.children = children;},
    append(...children) {this.children.push(...children);},
    addEventListener(type, fn) {this.listeners[type] = fn;}};
}
const document = {createElement: element};

test('accepts reviewed source-backed coordinates and keeps document identity', () => {
  const [record] = reviewedMapEvents([event]);
  assert.equal(record.source_url, event.source_url);
  assert.equal(record.source_host, 'archive.example.gov');
  assert.equal(record.lat, 37.7);
  assert.equal(record.location_source_url, event.location_source_url);
  assert.equal(record.location_source_host, 'archive.example.gov');
  assert.equal(record.location_note, event.location_note);
});

test('rejects unpublished, unsourced and mislocated events, without inventing a pin', () => {
  const invalid = [withChanges({review_status: 'pending'}), withChanges({source_url: ''}),
    withChanges({source_url: 'http://archive.example.gov/report'}),
    withChanges({source_url: 'javascript:alert(1)'}),
    withChanges({source_url: 'https://archive.example.gov@misleading.test/report'}),
    withChanges({lat: 91}), withChanges({lon: -181}),
    withChanges({lat: '37.7'}), withChanges({event_date: '2025-02-29'}),
    withChanges({category: 'unverified'}), withChanges({id: '  '}),
    withChanges({location_source_url: ''}), withChanges({location_source_url: 'http://archive.example.gov/'}),
    withChanges({location_source_url: 'javascript:alert(1)'}),
    withChanges({location_source_url: 'https://user:pass@archive.example.gov/location'}),
    withChanges({location_note: null}), withChanges({location_note: '  '})];
  for (const candidate of invalid) assert.equal(reviewedMapEvents([candidate]).length, 0,
    JSON.stringify(candidate));
});

test('future-dated occurrences cannot appear as verified geographic events', () => {
  // At 17:00 UTC the next calendar day has begun in UTC+14 locations.
  const lateUtc = Date.parse('2026-11-23T17:00:00Z');
  const mapAsOf = date => reviewedMapEvents([withChanges({event_date: date})], lateUtc);
  assert.equal(mapAsOf('2026-11-23').length, 1);
  assert.equal(mapAsOf('2026-11-24').length, 1,
    'do not reject a date that has begun in an eastern timezone');
  assert.deepEqual(mapAsOf('2026-11-25'), [],
    'dates beyond every inhabited timezone are not past events');
  assert.deepEqual(mapAsOf('9999-12-31'), []);

  // Before UTC+14 reaches the next day, even that date has not begun.
  assert.deepEqual(reviewedMapEvents(
    [withChanges({event_date: '2026-11-24'})],
    Date.parse('2026-11-23T08:00:00Z')
  ), []);

  const farFuture = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const list = element('ul');
  assert.deepEqual(renderReviewedMapList(document, list,
    [withChanges({event_date: farFuture})], () => {}), [],
  'the accessible list must not show impossible future occurrences either');
  assert.equal(list.children.length, 0);
});

test('deduplicates identifiers; no feed produces an empty list', () => {
  assert.deepEqual(reviewedMapEvents(null), []);
  assert.deepEqual(reviewedMapEvents([]), []);
  assert.equal(reviewedMapEvents([event, withChanges({title: 'Copy'})]).length, 1);
});

test('normalizes whitespace in event IDs so one event cannot create multiple pins or list entries', () => {
  const candidates = [
    withChanges({id: '  archived-record-1  '}),
    withChanges({id: 'archived-record-1', title: 'Duplicate must not render'}),
    withChanges({id: '\tarchived-record-1\n', title: 'Another duplicate must not render'})
  ];
  const reviewed = reviewedMapEvents(candidates);
  assert.equal(reviewed.length, 1);
  assert.equal(reviewed[0].id, 'archived-record-1');
  const list = element('ul');
  const rendered = renderReviewedMapList(document, list, candidates, () => {});
  assert.equal(rendered.length, 1);
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].children[0].textContent, 'Inspect Reviewed documented event');

  // A rejected record must not reserve its identifier and block a valid correction.
  const corrected = reviewedMapEvents([
    withChanges({id: ' archived-record-1 ', location_source_url: ''}),
    withChanges({id: 'archived-record-1'})
  ]);
  assert.equal(corrected.length, 1);
  assert.equal(corrected[0].id, 'archived-record-1');
});

test('withholds conflicting reviewed coordinates rather than arbitrarily pinning the first duplicate ID', () => {
  const candidates = [
    withChanges({id: ' record-a ', lat: 15, lon: 20}),
    withChanges({id: 'record-a', lat: 15, lon: 21}),
    withChanges({id: 'record-b', lat: 16, lon: 22})
  ];
  const reviewed = reviewedMapEvents(candidates);
  assert.deepEqual(reviewed.map(item => item.id), ['record-b']);
  const list = element('ul');
  const rendered = renderReviewedMapList(document, list, candidates, () => {});
  assert.deepEqual(rendered.map(item => item.id), ['record-b']);
  assert.equal(list.children.length, 1, 'conflicted event is excluded from accessible list and globe pins');

  // Identical coordinates may be indexed twice, but still produce one point.
  assert.equal(reviewedMapEvents([event, withChanges({title: 'Alternate indexed report'})]).length, 1);
  // Unreviewed or malformed records must not disqualify a corrected valid item.
  assert.equal(reviewedMapEvents([
    withChanges({id: ' corrected ', location_source_url: ''}),
    withChanges({id: 'corrected'})
  ]).length, 1);
  // Conflicts in either coordinate are material, independent of feed ordering.
  assert.equal(reviewedMapEvents([
    withChanges({id: 'reverse', lat: 15}), withChanges({id: ' reverse ', lat: 16})
  ]).length, 0);
});

test('withholds conflicted canonical event dates and categories without choosing feed order', () => {
  const conflicts = [
    withChanges({event_date: '2024-03-01'}),
    withChanges({category: 'positive'})
  ];
  for (const other of conflicts) {
    for (const candidates of [[event, other], [other, event]]) {
      assert.deepEqual(reviewedMapEvents(candidates), [],
        'a canonical event cannot get a first-seen date or category');
      const list = element('ul');
      assert.deepEqual(renderReviewedMapList(document, list, candidates, () => {}), []);
      assert.equal(list.children.length, 0, 'conflicting event stays off the map and list');
    }
    const allowed = reviewedMapEvents([
      event, other, withChanges({id: 'separate-reviewed-event'})
    ]);
    assert.deepEqual(allowed.map(item => item.id), ['separate-reviewed-event'],
      'unrelated verified events remain available');
  }

  // Same event, same location/date/category may have alternate source titles
  // without creating duplicate pins or silently making separate event IDs.
  assert.equal(reviewedMapEvents([
    event, withChanges({
      title: 'Another description of the same occurrence',
      source_url: 'https://other-archive.example.gov/alternate-document'
    })
  ]).length, 1);

  // A pending or invalid duplicate is not evidence of editorial disagreement.
  assert.equal(reviewedMapEvents([
    event, withChanges({review_status: 'pending', category: 'positive'})
  ]).length, 1);
});

test('withholds conflicting map-placement rationale for the same ID in either feed order', () => {
  const conflicting = withChanges({location_note: 'Exact address determined from independent records'});
  for (const candidates of [[event, conflicting], [conflicting, event]]) {
    assert.deepEqual(reviewedMapEvents(candidates), [],
      'different location precision claims cannot silently inherit the first citation');
    const list = element('ul');
    assert.deepEqual(renderReviewedMapList(document, list, candidates, () => {}), []);
    assert.equal(list.children.length, 0);
  }
  const unaffected = reviewedMapEvents([
    event, conflicting, withChanges({id: 'different-event'})
  ]);
  assert.deepEqual(unaffected.map(item => item.id), ['different-event']);
  assert.equal(reviewedMapEvents([
    event, withChanges({location_note: '  ' + event.location_note + '  '})
  ]).length, 1, 'insignificant surrounding whitespace is not a provenance conflict');
  assert.equal(reviewedMapEvents([
    event, withChanges({review_status: 'pending', location_note: 'Unreviewed rival placement'})
  ]).length, 1, 'unreviewed copies do not override a reviewed location');
});

test('withholds conflicting geographic source citations for one event ID, regardless of feed order', () => {
  const changedLocation = withChanges({
    location_source_url: 'https://other-archive.example.gov/map#district'
  });
  for (const candidates of [[event, changedLocation], [changedLocation, event]]) {
    assert.deepEqual(reviewedMapEvents(candidates), [],
      'a pin cannot silently choose the first location citation for a canonical event');
    const list = element('ul');
    assert.deepEqual(renderReviewedMapList(document, list, candidates, () => {}), []);
    assert.equal(list.children.length, 0, 'conflicted pins must not appear in accessible previews');
  }

  assert.deepEqual(reviewedMapEvents([
    event, changedLocation, withChanges({id: 'unrelated-reviewed-event'})
  ]).map(item => item.id), ['unrelated-reviewed-event'],
  'unrelated reviewed locations must remain accessible');

  assert.equal(reviewedMapEvents([
    event, withChanges({location_source_url: 'https://archive.example.gov:443/report?id=12#location'})
  ]).length, 1, 'semantically identical HTTPS citations normalize to one map placement');

  assert.equal(reviewedMapEvents([
    event, withChanges({source_url: 'https://other-archive.example.gov/second-report'})
  ]).length, 1, 'alternate reporting does not invalidate the same location evidence');
  assert.equal(reviewedMapEvents([
    event, withChanges({review_status: 'pending', location_source_url: 'https://other.example.gov/lead'})
  ]).length, 1, 'unreviewed location leads cannot invalidate a reviewed event');
});

test('renders keyboard-focusable inspection buttons with safe text, not HTML', () => {
  const list = element('ul');
  let selection;
  const records = renderReviewedMapList(document, list,
    [withChanges({title: '<img src=x onerror=alert(1)>'})], e => {selection = e;});
  assert.equal(records.length, 1);
  const [button, context] = list.children[0].children;
  assert.equal(button.tag, 'button');
  assert.equal(button.type, 'button');
  assert.equal(button.textContent, 'Inspect <img src=x onerror=alert(1)>');
  assert.match(context.textContent, /archive\.example\.gov/);
  button.listeners.click();
  assert.equal(selection.source_url, event.source_url);
  renderReviewedMapList(document, list, [], () => {});
  assert.equal(list.children.length, 0);
});

test('keyboard-list buttons describe original and geographic source roles without treating hosts as corroboration', () => {
  const list = element('ul');
  const alternateGeography = withChanges({
    id: 'archive-02',
    location_source_url: 'https://maps.example.org/location-proof#district'
  });
  const rendered = renderReviewedMapList(document, list, [event, alternateGeography], () => {});
  assert.equal(rendered.length, 2);

  const [firstButton, firstContext] = list.children[0].children;
  const [secondButton, secondContext] = list.children[1].children;
  assert.ok(firstContext.id);
  assert.notEqual(firstContext.id, secondContext.id, 'each button references its own provenance');
  assert.equal(firstButton.getAttribute('aria-describedby'), firstContext.id);
  assert.equal(secondButton.getAttribute('aria-describedby'), secondContext.id);
  assert.ok(firstContext.textContent.includes('Event source: archive.example.gov'));
  assert.ok(firstContext.textContent.includes('Location evidence: archive.example.gov'));
  assert.ok(secondContext.textContent.includes('Event source: archive.example.gov'));
  assert.ok(secondContext.textContent.includes('Location evidence: maps.example.org'));
  assert.doesNotMatch(secondContext.textContent, /independently confirmed|corroborated/i);
});

test('shows an accessible source preview with safe external-link attributes', () => {
  const panel = element('div');
  const [record] = reviewedMapEvents([event]);
  showReviewedMapSource(document, panel, record);
  assert.equal(panel.children[0].textContent, event.title);
  assert.match(panel.children[1].textContent, /editorially reviewed/);
  assert.match(panel.children[1].textContent, /archive\.example\.gov/);
  const link = panel.children[2];
  assert.equal(link.href, event.source_url);
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.match(panel.children[3].textContent, /approximate map position/);
  assert.match(panel.children[3].textContent, /not independently verified GPS precision/);
  const locationLink = panel.children[4];
  assert.equal(locationLink.href, event.location_source_url);
  assert.equal(locationLink.target, '_blank');
  assert.equal(locationLink.rel, 'noopener noreferrer');
});

test('original and location citations announce new-tab behavior while preserving the full URLs', () => {
  const panel = element('div');
  const [record] = reviewedMapEvents([event]);
  showReviewedMapSource(document, panel, record);
  const originalLink = panel.children[2];
  const geographicLink = panel.children[4];
  assert.equal(originalLink.textContent,
    'Inspect original source (opens in new tab): ' + event.source_url);
  assert.equal(geographicLink.textContent,
    'Inspect map location evidence (opens in new tab): ' + event.location_source_url);
  assert.equal(originalLink.href, event.source_url);
  assert.equal(geographicLink.href, event.location_source_url);
});

test('source preview identifies the canonical event and actual displayed map coordinates', () => {
  const [reviewed] = reviewedMapEvents([withChanges({
    id: '  archive-location-07  ', lat: 37.700123, lon: -122.400987
  })]);
  const panel = element('div');
  showReviewedMapSource(document, panel, reviewed);
  assert.match(panel.children[1].textContent, /Event ID: archive-location-07/);
  assert.match(panel.children[3].textContent,
    /Displayed map point: 37\.700123° latitude, -122\.400987° longitude/);
  assert.match(panel.children[3].textContent, /editorial placement, not independently verified GPS precision/);
  assert.equal(panel.children[4].href, event.location_source_url,
    'showing coordinates must never replace the inspectable geographic source');
});

test('map placement needs its own linked provenance and never invents a point', () => {
  const sourceOnly = withChanges({location_source_url: undefined, location_note: undefined});
  assert.equal(reviewedMapEvents([sourceOnly]).length, 0);
  const [reviewed] = reviewedMapEvents([withChanges({
    location_source_url: 'https://locations.example.org/coordinates?record=1#place',
    location_note: 'Approximate district center; source identifies the district, not the exact site'
  })]);
  assert.equal(reviewed.location_source_host, 'locations.example.org');
  assert.equal(reviewed.location_source_url, 'https://locations.example.org/coordinates?record=1#place');
  const panel = element('div');
  showReviewedMapSource(document, panel, reviewed);
  assert.equal(panel.children[4].href, reviewed.location_source_url);
});

test('list selection opens full-detail source evidence, focuses the region, and replaces stale data', () => {
  const panel = element('div');
  panel.hidden = true;
  panel.focus = () => { panel.focused = true; };
  const [record] = reviewedMapEvents([event]);
  inspectReviewedMapSource(document, panel, record);
  assert.equal(panel.hidden, false);
  assert.equal(panel.focused, true);
  assert.equal(panel.children[0].textContent, event.title);
  assert.equal(panel.children[2].href, event.source_url);
  assert.equal(panel.children[4].href, event.location_source_url);
  const [replacement] = reviewedMapEvents([withChanges({
    id: 'second-reviewed-event', title: '<script>not HTML</script>',
    location_source_url: 'https://archive.example.gov/second-location'
  })]);
  inspectReviewedMapSource(document, panel, replacement);
  assert.equal(panel.children.length, 5, 'prior detail must not remain');
  assert.equal(panel.children[0].textContent, '<script>not HTML</script>');
  assert.equal(panel.children[4].href, replacement.location_source_url);
});

test('return-to-list closes source preview and restores focus to the selected event', () => {
  const detail = element('div');
  detail.hidden = true;
  detail.focus = () => { detail.focused = true; };
  const list = element('ul');
  const events = [event, withChanges({id: 'archive-02', title: 'Second reviewed event'})];
  renderReviewedMapList(document, list, events, (record, button) =>
    inspectReviewedMapSource(document, detail, record, button));
  const firstButton = list.children[0].children[0];
  const selectedButton = list.children[1].children[0];
  selectedButton.focus = () => { selectedButton.focused = true; };
  assert.equal(firstButton.getAttribute('aria-controls'), 'reviewed-globe-detail');
  assert.equal(selectedButton.getAttribute('aria-controls'), 'reviewed-globe-detail');
  assert.equal(firstButton.getAttribute('aria-expanded'), 'false');
  assert.equal(selectedButton.getAttribute('aria-expanded'), 'false');
  firstButton.listeners.click();
  assert.equal(firstButton.getAttribute('aria-expanded'), 'true');
  assert.equal(selectedButton.getAttribute('aria-expanded'), 'false');
  selectedButton.listeners.click();
  assert.equal(firstButton.getAttribute('aria-expanded'), 'false');
  assert.equal(selectedButton.getAttribute('aria-expanded'), 'true');
  assert.equal(detail.focused, true);
  assert.equal(detail.hidden, false);
  assert.equal(detail.children[0].textContent, 'Second reviewed event');
  assert.equal(detail.children.length, 6, 'source links and return control are retained');
  const returnButton = detail.children[5];
  assert.equal(returnButton.tag, 'button');
  assert.equal(returnButton.type, 'button');
  assert.equal(returnButton.textContent, 'Back to map event list');
  returnButton.listeners.click();
  assert.equal(detail.hidden, true);
  assert.equal(detail.children.length, 0, 'closed previews do not leave stale links');
  assert.equal(selectedButton.focused, true, 'keyboard focus returns to the originating event');
  assert.equal(selectedButton.getAttribute('aria-expanded'), 'false',
    'closed preview must not still announce expanded');
  assert.equal(firstButton.getAttribute('aria-expanded'), 'false');
});

test('Escape closes the current reviewed-source preview and returns focus to its originating event', () => {
  const detail = element('div');
  detail.hidden = true;
  detail.focus = () => {};
  const list = element('ul');
  renderReviewedMapList(document, list, [event, withChanges({id: 'archive-02', title: 'Second event'})],
    (record, button) => inspectReviewedMapSource(document, detail, record, button));
  const first = list.children[0].children[0];
  const second = list.children[1].children[0];
  first.focus = () => { first.focused = true; };
  second.focus = () => { second.focused = true; };

  first.listeners.click();
  const previousHandler = detail.onkeydown;
  second.listeners.click();
  assert.notEqual(detail.onkeydown, previousHandler, 'the current selection replaces the previous handler');
  assert.equal(second.getAttribute('aria-expanded'), 'true');
  let prevented = false;
  detail.onkeydown({key: 'Tab', preventDefault() { prevented = true; }});
  assert.equal(detail.hidden, false, 'ordinary keyboard navigation does not dismiss the panel');
  assert.equal(prevented, false);

  for (const flag of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'defaultPrevented', 'isComposing']) {
    const currentHandler = detail.onkeydown;
    const currentChildren = detail.children;
    detail.onkeydown({key: 'Escape', [flag]: true, preventDefault() { prevented = true; }});
    assert.equal(prevented, false, flag + ' must not consume the key');
    assert.equal(detail.hidden, false, flag + ' must not dismiss the panel');
    assert.equal(detail.onkeydown, currentHandler);
    assert.equal(detail.children, currentChildren);
    assert.equal(second.getAttribute('aria-expanded'), 'true');
    assert.equal(second.focused, undefined, 'ignored key must not move focus');
  }

  detail.onkeydown({key: 'Escape', preventDefault() { prevented = true; }});
  assert.equal(prevented, true);
  assert.equal(detail.hidden, true);
  assert.equal(detail.children.length, 0);
  assert.equal(detail.onkeydown, null, 'closed panel leaves no stale Escape handler');
  assert.equal(second.focused, true, 'focus returns to the most recent event button');
  assert.equal(first.focused, undefined, 'stale source does not receive focus');
  assert.equal(second.getAttribute('aria-expanded'), 'false');

  first.listeners.click();
  detail.children[5].listeners.click();
  assert.equal(detail.hidden, true, 'the existing return button still closes the panel');
  assert.equal(detail.onkeydown, null, 'button closure also clears the handler');
  assert.equal(first.focused, true);
});

test('unmarked globe surface selections do not imply verified event locations', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('function inspectLocation(e){');
  const end = html.indexOf('function bindGlobeGestures(', start);
  assert.ok(start >= 0 && end > start, 'source-preview globe inspection handler exists');
  const inspection = html.slice(start, end);
  assert.match(inspection, /Globe cursor:/);
  assert.match(inspection, /approximate globe-surface selection, not a verified event location/);
  assert.match(inspection, /mapRecords\.length\s*\?/,
    'the message must depend on whether reviewed event pins exist');
  assert.match(inspection, /No reviewed event marker was selected here/);
  assert.match(inspection, /No reviewed geographic events are available in this feed/);
  assert.doesNotMatch(inspection, /Verified local news events are not yet connected/,
    'reviewed pins must not trigger a false empty-feed notice');
});

test('homepage places the keyboard preview beside the event list, not only in the tiny globe overlay', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="reviewed-globe-events"><\/ul>[\s\S]*?id="reviewed-globe-detail"/);
  assert.match(html, /id="reviewed-globe-detail"[^>]+role="region"[^>]+tabindex="-1" hidden/);
  assert.match(html, /renderReviewedMapList\(document,mapList,mapEventCandidates,\(event,button\)=>inspectReviewedMapSource\(document,document\.getElementById\('reviewed-globe-detail'\),event,button,document\.getElementById\('geo-panel'\)\)\)/);
  assert.match(html, /showReviewedMapSource\(document,geoPanel,selectedMarker\)/, 'globe marker click preview preserved');
  assert.match(html, /\.reviewed-globe-detail button\{display:block;[^}]*min-height:44px/);
  assert.match(html, /\.reviewed-globe-detail:focus\{outline:/);
});

test('previews expose exact original and geographic citation URLs without losing query or fragment', () => {
  const record = withChanges({
    source_url: 'https://records.example.gov/archive/search?id=12#document-3',
    location_source_url: 'https://records.example.gov/map/location?ref=23#coordinates'
  });
  const [reviewed] = reviewedMapEvents([record]);
  const panel = element('div');
  showReviewedMapSource(document, panel, reviewed);
  assert.equal(panel.children[2].textContent, 'Inspect original source (opens in new tab): ' + record.source_url);
  assert.equal(panel.children[4].textContent,
    'Inspect map location evidence (opens in new tab): ' + record.location_source_url);
  assert.equal(panel.children[2].href, record.source_url);
  assert.equal(panel.children[4].href, record.location_source_url);
  assert.notEqual(panel.children[2].textContent, panel.children[4].textContent,
    'same-host citations must retain their distinct document identities');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /\.reviewed-globe-detail a\{[^}]*max-width:100%;[^}]*overflow-wrap:anywhere/);
});

test('same-document location citations disclose one source, including when page fragments differ', () => {
  const locationPage = withChanges({
    source_url: 'https://archive.example.gov/report?id=12#p3',
    location_source_url: 'https://archive.example.gov/report?id=12#map-page'
  });
  const [reviewed] = reviewedMapEvents([locationPage]);
  assert.equal(reviewed.location_cites_same_document, true,
    'different anchors in the same document do not create independent evidence');
  const panel = element('div');
  showReviewedMapSource(document, panel, reviewed);
  assert.match(panel.children[3].textContent, /reuses the same document/i);
  assert.match(panel.children[3].textContent, /not independent corroboration/i);
  assert.equal(panel.children[2].href, locationPage.source_url);
  assert.equal(panel.children[4].href, locationPage.location_source_url,
    'distinct section references remain inspectable');
  const list = element('ul');
  renderReviewedMapList(document, list, [locationPage], () => {});
  assert.match(list.children[0].children[1].textContent,
    /Same document used for both citations; not independent corroboration/);
});

test('different location URLs remain distinct without claiming source independence', () => {
  const otherPath = withChanges({
    location_source_url: 'https://archive.example.gov/maps?id=12#page=2'
  });
  const otherQuery = withChanges({
    location_source_url: 'https://archive.example.gov/report?id=13#map'
  });
  for (const candidate of [otherPath, otherQuery]) {
    const [reviewed] = reviewedMapEvents([candidate]);
    assert.equal(reviewed.location_cites_same_document, false,
      'path and query are part of document identity');
    const panel = element('div');
    showReviewedMapSource(document, panel, reviewed);
    assert.match(panel.children[3].textContent, /does not by itself establish independent corroboration/);
    const list = element('ul');
    renderReviewedMapList(document, list, [candidate], () => {});
    assert.match(list.children[0].children[1].textContent,
      /Distinct citation URL; independence not established/);
    assert.equal(panel.children[4].href, candidate.location_source_url);
  }
});


test('globe checks all feed records before Pulse deduplication can hide a disputed location', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /let reviewedEvents=\[\],mapEventCandidates=\[\],pulseLoaded=false/);
  assert.match(html, /if\(feed\.schema_version!==1\|\|!Array\.isArray\(feed\.events\)\)throw Error\("invalid feed"\);mapEventCandidates=feed\.events/,
    'only a schema-valid original feed supplies map candidates');
  assert.match(html, /renderReviewedMapList\(document,mapList,mapEventCandidates,/,
    'map provenance gate must inspect the complete feed, not the already-deduplicated Pulse count');
  assert.doesNotMatch(html, /renderReviewedMapList\(document,mapList,reviewedEvents,/);

  // The count filter's first-seen ID is intentionally not enough to pick a map position.
  const conflicting = [event, withChanges({lon: -121.1})];
  assert.deepEqual(reviewedMapEvents(conflicting), [], 'conflicting reviewed longitudes suppress the pin');
  const firstSeen = new Set();
  const countDeduplicated = conflicting.filter(item => {
    if (firstSeen.has(item.id)) return false;
    firstSeen.add(item.id);
    return true;
  });
  assert.equal(reviewedMapEvents(countDeduplicated).length, 1,
    'premature count deduplication would hide the geographic disagreement');
});


test('globe marker selection opens the same accessible full-width preview as a list button', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('function inspectLocation(e){');
  const end = html.indexOf('function bindGlobeGestures(', start);
  assert.ok(start >= 0 && end > start);
  const inspection = html.slice(start, end);
  assert.match(inspection, /showReviewedMapSource\(document,geoPanel,selectedMarker\)/,
    'the existing globe-surface source readout remains available');
  assert.match(inspection, /mapRecords\.findIndex\(record=>record\.id===selectedMarker\.id\)/,
    'marker selection matches its reviewed canonical event, not a title or unreviewed ID');
  assert.match(inspection, /mapList\.children\[listIndex\]\?\.querySelector\('button'\)/);
  assert.match(inspection, /if\(sourceButton\)sourceButton\.click\(\)/,
    'reusing the accessible button preserves focus, source provenance, Back and Escape');

  const detail = element('div');
  detail.hidden = true;
  detail.focus = () => {detail.focused = true;};
  const list = element('ul');
  const second = withChanges({id: 'archive-02', title: 'Second cited location',
    location_source_url: 'https://locations.example.gov/map#p2'});
  const records = renderReviewedMapList(document, list, [event, second], (record, button) =>
    inspectReviewedMapSource(document, detail, record, button));
  const selected = records.findIndex(record => record.id === second.id);
  assert.equal(selected, 1);
  const button = list.children[selected].children[0];
  button.focus = () => {button.focused = true;};
  button.listeners.click();
  assert.equal(detail.hidden, false);
  assert.equal(detail.focused, true);
  assert.equal(detail.children[0].textContent, second.title);
  assert.equal(detail.children[4].href, second.location_source_url);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  detail.children[5].listeners.click();
  assert.equal(button.focused, true, 'Back returns to the selected event');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});


test('same-title map events expose distinct canonical IDs and placement rationale before inspection', () => {
  const list = element('ul');
  const second = withChanges({id: ' archive-02 ',
    location_note: 'Approximate regional center; original record identifies only the region'});
  const records = renderReviewedMapList(document, list, [event, second], () => {});
  assert.equal(records.length, 2);
  const [firstButton, firstContext] = list.children[0].children;
  const [secondButton, secondContext] = list.children[1].children;
  assert.equal(firstButton.textContent, 'Inspect ' + event.title + ' (Event ID: archive-01)');
  assert.equal(secondButton.textContent, 'Inspect ' + second.title + ' (Event ID: archive-02)');
  assert.equal(firstButton.getAttribute('aria-describedby'), firstContext.id);
  assert.equal(secondButton.getAttribute('aria-describedby'), secondContext.id);
  assert.ok(firstContext.textContent.includes('Event ID: archive-01 ·'));
  assert.ok(secondContext.textContent.includes('Event ID: archive-02 ·'));
  assert.ok(firstContext.textContent.includes('Map placement: ' + event.location_note));
  assert.ok(secondContext.textContent.includes('Map placement: ' + second.location_note));
  assert.ok(firstContext.textContent.includes('Same document used for both citations; not independent corroboration'));
});

test('requires an explicit supported location role and withholds non-geographic policy and office references', () => {
  for (const role of [undefined, null, '', 'announcement_city_only', 'issuing_office_city_only',
    'national_policy_scope_only', 'invented_role']) {
    const candidate = withChanges({location_role: role});
    assert.deepEqual(reviewedMapEvents([candidate]), []);
    const list = element('ul');
    assert.deepEqual(renderReviewedMapList(document, list, [candidate], () => {}), []);
    assert.equal(list.children.length, 0);
  }
});

test('reference and beneficiary points disclose their distinct roles in both source inspection paths', () => {
  for (const [role, label] of [
    ['occurrence_site', 'Occurrence site'],
    ['archaeological_site_reference', 'Archaeological site reference (not an exact excavation or publication point)'],
    ['beneficiary_site', 'Beneficiary site (not necessarily the decision or activity venue)']
  ]) {
    const candidate = withChanges({location_role: role});
    const [record] = reviewedMapEvents([candidate]);
    assert.equal(record.location_role, role);
    assert.equal(record.location_role_label, label);
    const panel = element('div');
    showReviewedMapSource(document, panel, record);
    assert.ok(panel.children[3].textContent.includes('Location role: ' + label));
    assert.equal(panel.children[4].href, event.location_source_url);
    const list = element('ul');
    renderReviewedMapList(document, list, [candidate], () => {});
    assert.ok(list.children[0].children[1].textContent.includes('Location role: ' + label));
  }
});

test('conflicting geographic roles for one event ID suppress the point in either order', () => {
  const reference = withChanges({location_role: 'beneficiary_site'});
  for (const candidates of [[event, reference], [reference, event]]) {
    assert.deepEqual(reviewedMapEvents(candidates), []);
    const list = element('ul');
    assert.deepEqual(renderReviewedMapList(document, list, candidates, () => {}), []);
    assert.equal(list.children.length, 0);
  }
  assert.equal(reviewedMapEvents([event, withChanges({location_role: 'beneficiary_site', review_status: 'pending'})]).length, 1);
});


test('map availability distinguishes failed, empty, withheld and eligible records without claiming global coverage', () => {
  assert.match(reviewedMapAvailability(false, 0, 0), /feed unavailable/i);
  assert.match(reviewedMapAvailability(true, 0, 0), /no event records yet/i);
  const pending = [withChanges({review_status: 'pending'})];
  assert.match(reviewedMapAvailability(true, pending.length, reviewedMapEvents(pending).length),
    /No event in this feed qualifies/);
  const conflict = [event, withChanges({lon: 10})];
  assert.match(reviewedMapAvailability(true, conflict.length, reviewedMapEvents(conflict).length),
    /conflicting records/);
  assert.match(reviewedMapAvailability(true, 2, 1), /1 reviewed map event is/);
  assert.match(reviewedMapAvailability(true, 3, 2), /2 reviewed map events are/);
  assert.match(reviewedMapAvailability(true, 3, 2), /not global coverage/);
  assert.match(reviewedMapAvailability(true, 0, 0), /not a count of events worldwide/);
});
test('map eligibility status remains visible even without WebGL or eligible map records', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<section id="reviewed-globe-browser" class="reviewed-globe-browser" aria-labelledby="reviewed-globe-title">/);
  assert.match(html, /id="reviewed-globe-availability" role="status" aria-atomic="true"/);
  assert.match(html, /mapEventCandidates=feed\.events;mapFeedAvailable=true;/);
  assert.ok(html.indexOf("textContent=reviewedMapAvailability(mapFeedAvailable,mapEventCandidates.length,mapRecords.length)") <
    html.indexOf("const THREE=await import"), 'map availability must be updated before WebGL setup');
  assert.doesNotMatch(html, /getElementById\('reviewed-globe-browser'\)\.hidden=mapRecords\.length===0/);
});


test('alternate reviewed citations remain inspectable without inflating canonical map events', () => {
  const alternate = withChanges({title: 'Alternate description',
    source_url: 'https://other-archive.example.gov/report?id=28#page-4'});
  for (const feed of [[event, alternate, alternate], [alternate, event, event]]) {
    const records = reviewedMapEvents(feed);
    assert.equal(records.length, 1);
    assert.deepEqual(records[0].alternate_sources, [
      {url: feed[1].source_url, title: feed[1].title}
    ]);
    const panel = element('div');
    showReviewedMapSource(document, panel, records[0]);
    assert.match(panel.children[5].textContent, /not additional events or established independent corroboration/);
    const link = panel.children[6].children[0].children[0];
    assert.equal(link.href, feed[1].source_url);
    assert.equal(link.rel, 'noopener noreferrer');
    assert.equal(link.target, '_blank');
    assert.ok(link.textContent.includes(feed[1].title));
    const list = element('ul');
    renderReviewedMapList(document, list, feed, () => {});
    assert.equal(list.children.length, 1);
    assert.match(list.children[0].children[1].textContent, /1 additional indexed event citation/);
  }
});

test('alternate citations do not bypass review, URL or geographic conflict gates', () => {
  const alternate = withChanges({source_url: 'https://other-archive.example.gov/report#p4'});
  for (const excluded of [
    {...alternate, review_status: 'pending'},
    {...alternate, source_url: 'javascript:alert(1)'},
    {...alternate, source_url: 'https://user:secret@other-archive.example.gov/report'}
  ]) {
    assert.deepEqual(reviewedMapEvents([event, excluded])[0].alternate_sources, []);
  }
  assert.deepEqual(reviewedMapEvents([event, {...alternate, lon: 20}]), []);
  assert.deepEqual(reviewedMapEvents([event, {...alternate, location_note: 'Conflicting precision'}]), []);
  assert.deepEqual(reviewedMapEvents([event, withChanges({
    source_url: 'https://archive.example.gov:443/report?id=12#p3'
  })])[0].alternate_sources, [], 'canonical equivalent URL is not a second citation');
});


test('overlapping globe markers never silently select one canonical event', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('const visibleMarkerEvents=');
  const end = html.indexOf('  if(visibleMarkerEvents.length===1)', start);
  assert.ok(start >= 0 && end > start);
  const selection = html.slice(start, end);
  const run = new Function('markerHits', 'hit', 'geoPanel', 'document', 'mapList', 'mapRecords',
    selection + '\nreturn visibleMarkerEvents;');
  const marker = (record, distance) => ({distance, object: {userData: {event: record}}});
  const [first, second] = reviewedMapEvents([event, withChanges({id: 'archive-02', title: 'Other event'})]);
  const geoPanel = element('div');
  const detail = element('div');
  detail.hidden = false;
  detail.onkeydown = () => {};
  detail.append(element('p'));
  const buttons = [element('button'), element('button')];
  for (const button of buttons) {
    button.setAttribute('aria-expanded', 'true');
    button.focus = () => {button.focused = true;};
  }
  const mapList = {children: buttons.map(button => ({querySelector: () => button}))};
  const doc = {getElementById: id => {assert.equal(id, 'reviewed-globe-detail'); return detail;}};
  const args = [geoPanel, doc, mapList, [first, second]];
  // Two ray intersections for one mesh still identify just one event.
  assert.deepEqual(run([marker(first, 1), marker(first, 1.01)], {distance: 1.1}, ...args), [first]);
  // An occluded marker must not create an ambiguous selection.
  assert.deepEqual(run([marker(first, 1), marker(second, 2)], {distance: 1.1}, ...args), [first]);
  assert.deepEqual(run([marker(second, 2)], {distance: 1.1}, ...args), []);
  // Both visible: no chosen record; clear stale detail and focus the first listed candidate.
  assert.equal(run([marker(second, 1), marker(first, 1.01)], {distance: 1.1}, ...args), undefined);
  assert.match(geoPanel.textContent, /Multiple reviewed event markers overlap here \(2\)/);
  assert.ok(geoPanel.textContent.includes(first.id) && geoPanel.textContent.includes(second.id));
  assert.match(geoPanel.textContent, /do not establish a relationship/);
  assert.equal(detail.hidden, true);
  assert.equal(detail.children.length, 0);
  assert.equal(detail.onkeydown, null);
  assert.ok(buttons.every(button => button.getAttribute('aria-expanded') === 'false'));
  assert.equal(buttons[0].focused, true);
  assert.equal(buttons[1].focused, undefined);
});


test('optional indexed citations remain safe, deduplicated, and distinct from reviewed map provenance', () => {
  const supplementary = 'https://catalog.example.org/item?id=5#p3';
  const alternate = 'https://another.example.org/report';
  const later = 'https://catalog.example.org/item?id=6#page';
  const records = [
    withChanges({additional_source_urls: [supplementary, 'https://catalog.example.org:443/item?id=5#p3',
      event.source_url, event.location_source_url, alternate, 'javascript:alert(1)',
      'http://catalog.example.org/unsafe', 'https://user:pass@catalog.example.org/unsafe', null, {}]}),
    withChanges({source_url: alternate, additional_source_urls: [supplementary, later]}),
    withChanges({review_status: 'pending', additional_source_urls: ['https://pending.example.org/lead']})
  ];
  const list = element('ul');
  let selected;
  const mapped = renderReviewedMapList(document, list, records, record => {selected = record;});
  assert.equal(mapped.length, 1, 'citations never create additional map points');
  assert.equal(mapped[0].alternate_sources.length, 1);
  assert.deepEqual(mapped[0].additional_source_urls, [supplementary, later]);
  assert.equal(mapped[0].location_source_url, event.location_source_url);
  assert.match(list.children[0].children[1].textContent, /2 supplemental indexed link\(s\); individual review not established/);
  list.children[0].children[0].listeners.click();
  const panel = element('div');
  showReviewedMapSource(document, panel, selected);
  assert.match(panel.children[7].textContent, /individual review and independent corroboration are not established/);
  assert.match(panel.children[7].textContent, /do not establish map placement/);
  const links = panel.children[8].children.map(item => item.children[0]);
  assert.deepEqual(links.map(link => link.href), [supplementary, later]);
  for (const link of links) {
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
    assert.match(link.textContent, /opens in new tab/);
  }
});

test('optional indexed links cannot qualify a missing or conflicting location for publication', () => {
  const extra = ['https://catalog.example.org/map'];
  assert.deepEqual(reviewedMapEvents([withChanges({location_source_url: '', additional_source_urls: extra})]), []);
  assert.deepEqual(reviewedMapEvents([event, withChanges({lon: 10, additional_source_urls: extra})]), []);
  const [malformed] = reviewedMapEvents([withChanges({additional_source_urls: extra[0]})]);
  assert.deepEqual(malformed.additional_source_urls, []);
});


test('indexed counterevidence is visible as a separate role in pointer and keyboard previews', () => {
  const opposing = 'https://catalog.example.org/alternative?id=5#p3';
  const second = 'https://other.example.org/review';
  const supplemental = 'https://catalog.example.org/context';
  const records = [
    withChanges({counterevidence_urls: [opposing, 'https://catalog.example.org:443/alternative?id=5#p3',
      'javascript:alert(1)', 'https://user:pass@catalog.example.org/unsafe',
      'http://catalog.example.org/unsafe', null, {}, event.source_url],
      additional_source_urls: [opposing, supplemental]}),
    withChanges({counterevidence_urls: [opposing, second]}),
    withChanges({review_status: 'pending', counterevidence_urls: ['https://pending.example.org/lead']})
  ];
  const list = element('ul');
  let selected;
  const mapped = renderReviewedMapList(document, list, records, record => {selected = record;});
  assert.equal(mapped.length, 1);
  assert.deepEqual(mapped[0].counterevidence_urls, [opposing, event.source_url, second],
    'preserve explicit counterevidence role even when a primary citation is reused');
  assert.deepEqual(mapped[0].additional_source_urls, [supplemental],
    'a counterevidence URL should not be repeated as generic supplemental evidence');
  assert.match(list.children[0].children[1].textContent, /3 indexed counterevidence link/);
  list.children[0].children[0].listeners.click();
  for (const record of [mapped[0], selected]) {
    const panel = element('div');
    showReviewedMapSource(document, panel, record);
    assert.match(panel.children[7].textContent, /whether they contradict the event are not established/);
    assert.match(panel.children[7].textContent, /do not establish map placement/);
    assert.equal(panel.children[2].href, event.source_url);
    assert.equal(panel.children[4].href, event.location_source_url);
    const links = panel.children[8].children.map(item => item.children[0]);
    assert.deepEqual(links.map(link => link.href), [opposing, event.source_url, second]);
    for (const link of links) {
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
      assert.match(link.textContent, /Inspect indexed counterevidence \(opens in new tab\)/);
    }
  }
});

test('counterevidence links cannot establish a missing or conflicting geographic placement', () => {
  const counterevidence_urls = ['https://catalog.example.org/map'];
  assert.deepEqual(reviewedMapEvents([withChanges({location_source_url: '', counterevidence_urls})]), []);
  assert.deepEqual(reviewedMapEvents([event, withChanges({lon: 10, counterevidence_urls})]), []);
  const [malformed] = reviewedMapEvents([withChanges({counterevidence_urls: counterevidence_urls[0]})]);
  assert.deepEqual(malformed.counterevidence_urls, []);
});


test('editorial correction notes survive duplicate reviewed records and reach both inspection paths as text', () => {
  const note = '<img src=x onerror=alert(1)> Corrected description';
  const other = 'https://catalog.example.org/other#page-2';
  const records = [
    withChanges({correction_note: '  ' + note + '  '}),
    withChanges({correction_note: note}),
    withChanges({source_url: other, correction_note: 'Separate indexed correction'}),
    withChanges({review_status: 'pending', correction_note: 'Pending note'}),
    withChanges({source_url: 'javascript:alert(1)', correction_note: 'Unsafe source note'})
  ];
  const list = element('ul');
  let selected;
  const mapped = renderReviewedMapList(document, list, records, record => {selected = record;});
  assert.equal(mapped.length, 1);
  assert.deepEqual(mapped[0].correction_notes, [
    {note, source_url: event.source_url},
    {note: 'Separate indexed correction', source_url: other}
  ]);
  assert.match(list.children[0].children[1].textContent, /2 indexed editorial correction note/);
  list.children[0].children[0].listeners.click();
  for (const record of [mapped[0], selected]) {
    const panel = element('div');
    showReviewedMapSource(document, panel, record);
    assert.match(panel.children.at(-2).textContent, /not independent findings and do not establish map placement/);
    const items = panel.children.at(-1).children;
    assert.equal(items.length, 2);
    assert.equal(items[0].textContent, note + ' — Indexed under event citation: ' + event.source_url);
    assert.equal(items[1].textContent, 'Separate indexed correction — Indexed under event citation: ' + other);
    assert.equal(items[0].children.length, 0, 'markup is not parsed');
  }
});

test('correction notes cannot qualify a missing or conflicting location and malformed notes are ignored', () => {
  const correction_note = 'Editorial note';
  assert.deepEqual(reviewedMapEvents([withChanges({location_source_url: '', correction_note})]), []);
  assert.deepEqual(reviewedMapEvents([event, withChanges({lon: 10, correction_note})]), []);
  for (const invalid of [null, {}, 42, '  ']) {
    assert.deepEqual(reviewedMapEvents([withChanges({correction_note: invalid})])[0].correction_notes, []);
  }
});


test('selecting an unmarked globe point clears stale event provenance and expanded state', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('function inspectLocation(e){');
  const end = html.indexOf(' function bindGlobeGestures', start);
  assert.ok(start >= 0 && end > start);
  const createInspect = new Function('canvas', 'mouse', 'raycaster', 'camera', 'markerMeshes',
    'earth', 'globe', 'geoPanel', 'document', 'mapList', 'mapRecords', 'showReviewedMapSource',
    html.slice(start, end) + '\nreturn inspectLocation;');
  const detail = element('div');
  detail.hidden = false;
  detail.append(element('p'));
  detail.onkeydown = () => {};
  const buttons = [element('button'), element('button')];
  buttons[0].setAttribute('aria-expanded', 'true');
  buttons[1].setAttribute('aria-expanded', 'false');
  const mapList = {children: buttons.map(button => ({querySelector: () => button}))};
  const geoPanel = element('div');
  const hit = {distance: 1, point: {clone: () => ({})}};
  let surface = [];
  const raycaster = {setFromCamera() {}, intersectObjects: () => [], intersectObject: () => surface};
  const canvas = {getBoundingClientRect: () => ({left: 0, top: 0, width: 100, height: 100})};
  const globe = {worldToLocal: () => ({normalize: () => ({x: 1, y: 0, z: 0})})};
  const inspect = createInspect(canvas, {set() {}}, raycaster, {}, [], {}, globe, geoPanel,
    {getElementById: id => {assert.equal(id, 'reviewed-globe-detail'); return detail;}},
    mapList, [event], () => assert.fail('unmarked point has no reviewed source'));
  // A tap outside the Earth is not a location selection.
  inspect({clientX: 50, clientY: 50});
  assert.equal(detail.hidden, false);
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'true');
  // An actual surface tap must remove any old source association.
  surface = [hit];
  inspect({clientX: 50, clientY: 50});
  assert.equal(detail.hidden, true);
  assert.equal(detail.children.length, 0);
  assert.equal(detail.onkeydown, null);
  assert.ok(buttons.every(button => button.getAttribute('aria-expanded') === 'false'));
  assert.match(geoPanel.textContent, /not a verified event location/);
  assert.match(geoPanel.textContent, /No reviewed event marker was selected here/);
});

test('keyboard and marker selections share identity without duplicating the full provenance in the live status', () => {
  const compact = element('div');
  const detail = element('div');
  detail.focus = () => {};
  const list = element('ul');
  const second = withChanges({id: 'archive-02', title: 'Different reviewed occurrence',
    source_url: 'https://archive.example.gov/second#p2'});
  renderReviewedMapList(document, list, [event, second],
    (record, button) => inspectReviewedMapSource(document, detail, record, button, compact));
  const firstButton = list.children[0].children[0];
  const secondButton = list.children[1].children[0];
  firstButton.focus = () => {firstButton.focused = true;};
  secondButton.focus = () => {secondButton.focused = true;};
  firstButton.listeners.click();
  assert.equal(compact.children.length, 0, 'live status contains no duplicate interactive source links');
  assert.ok(compact.textContent.includes(event.title + ' (' + event.id + ')'));
  assert.match(compact.textContent, /Original sources and map placement evidence are in the selected event detail below/);
  assert.equal(compact.textContent.includes(event.source_url), false);
  assert.equal(detail.children[2].href, event.source_url);
  secondButton.listeners.click();
  assert.equal(compact.children.length, 0);
  assert.ok(compact.textContent.includes(second.title + ' (' + second.id + ')'));
  assert.equal(compact.textContent.includes(event.title), false);
  assert.equal(compact.textContent.includes(second.source_url), false);
  assert.equal(detail.children[2].href, second.source_url);
  assert.equal(detail.children[4].href, second.location_source_url);
  detail.onkeydown({key: 'Escape', preventDefault() {}});
  assert.equal(compact.children.length, 0);
  assert.match(compact.textContent, /No reviewed event selected/);
  assert.equal(detail.children.length, 0);
  assert.equal(secondButton.focused, true);
  firstButton.listeners.click();
  detail.children.at(-1).listeners.click();
  assert.equal(compact.children.length, 0);
  assert.equal(detail.hidden, true);
  assert.equal(firstButton.focused, true);
});


test('indexed date basis distinguishes a report or approval date from underlying activity', () => {
  const note = '<b>Report published on event date; excavation dates unknown</b>';
  const other = 'https://archive.example.gov/other#p4';
  const records = [
    withChanges({date_basis: '  ' + note + '  '}),
    withChanges({date_basis: note}),
    withChanges({source_url: other, date_basis: 'Follow-up report; activity date not established'}),
    withChanges({review_status: 'pending', date_basis: 'Unreviewed note'}),
    withChanges({source_url: 'javascript:alert(1)', date_basis: 'Unsafe citation'})
  ];
  const list = element('ul');
  let selected;
  const mapped = renderReviewedMapList(document, list, records, record => {selected = record;});
  assert.equal(mapped.length, 1);
  assert.deepEqual(mapped[0].date_basis_notes, [
    {note, source_url: event.source_url},
    {note: 'Follow-up report; activity date not established', source_url: other}
  ]);
  assert.match(list.children[0].children[1].textContent, /2 indexed date-basis note/);
  list.children[0].children[0].listeners.click();
  for (const record of [mapped[0], selected]) {
    const panel = element('div');
    showReviewedMapSource(document, panel, record);
    assert.match(panel.children[1].textContent, /not necessarily the date of the underlying activity/);
    assert.ok(panel.children[1].textContent.includes(note + ' — Citation: ' + event.source_url));
    assert.ok(panel.children[1].textContent.includes(other));
    assert.equal(panel.children[1].children.length, 0, 'render notes as text, not markup');
    assert.equal(panel.children[4].href, event.location_source_url);
  }
});

test('date-basis notes never override event date or geographic eligibility', () => {
  const date_basis = 'Report date only';
  for (const changes of [{event_date: '2024-02-30'}, {event_date: '9999-12-31'}, {location_source_url: ''}]) {
    assert.deepEqual(reviewedMapEvents([withChanges({...changes, date_basis})]), []);
  }
  assert.deepEqual(reviewedMapEvents([event, withChanges({event_date: '2024-03-01', date_basis})]), []);
  for (const malformed of [null, {}, 42, '  ']) {
    assert.deepEqual(reviewedMapEvents([withChanges({date_basis: malformed})])[0].date_basis_notes, []);
  }
  const panel = element('div');
  showReviewedMapSource(document, panel, reviewedMapEvents([event])[0]);
  assert.match(panel.children[1].textContent, /No separate date-basis note is indexed/);
});


test('source limitations preserve their own reviewed citations in both inspection paths', () => {
  const note = '<b>Not independently confirmed</b>';
  const other = 'https://archive.example.gov/second#p4';
  const records = [
    withChanges({source_limitation: '  ' + note + '  '}),
    withChanges({source_limitation: note}),
    withChanges({source_url: other, source_limitation: 'Different source limitation'}),
    withChanges({review_status: 'pending', source_limitation: 'Pending note'}),
    withChanges({source_url: 'javascript:alert(1)', source_limitation: 'Unsafe note'})
  ];
  const list = element('ul');
  let selected;
  const mapped = renderReviewedMapList(document, list, records, record => {selected = record;});
  assert.equal(mapped.length, 1);
  assert.deepEqual(mapped[0].source_limitations, [
    {note, source_url: event.source_url},
    {note: 'Different source limitation', source_url: other}
  ]);
  assert.match(list.children[0].children[1].textContent, /2 indexed source limitation/);
  list.children[0].children[0].listeners.click();
  for (const record of [mapped[0], selected]) {
    const panel = element('div');
    showReviewedMapSource(document, panel, record);
    assert.match(panel.children.at(-2).textContent, /not independent findings/);
    assert.match(panel.children.at(-2).textContent, /do not establish map placement/);
    const items = panel.children.at(-1).children;
    assert.equal(items[0].textContent, note + ' — Indexed under event citation: ' + event.source_url);
    assert.equal(items[0].children.length, 0, 'render notes as text, not markup');
    assert.equal(items[1].textContent, 'Different source limitation — Indexed under event citation: ' + other);
  }
});

test('source limitations cannot establish map eligibility or override conflicting locations', () => {
  const source_limitation = 'Context only';
  assert.deepEqual(reviewedMapEvents([withChanges({location_source_url: '', source_limitation})]), []);
  assert.deepEqual(reviewedMapEvents([event, withChanges({lat: 10, source_limitation})]), []);
  for (const malformed of [null, {}, 42, '  ']) {
    assert.deepEqual(reviewedMapEvents([withChanges({source_limitation: malformed})])[0].source_limitations, []);
  }
});


test('editorial classification rationale retains its own citation in map and accessible previews', () => {
  const note = '<b>Provisional assessment, not a measured outcome</b>';
  const other = 'https://archive.example.gov/other#p4';
  const rows = [
    withChanges({classification_rationale: '  ' + note + '  '}),
    withChanges({classification_rationale: note}),
    withChanges({source_url: other, classification_rationale: 'Different editorial rationale'}),
    withChanges({review_status: 'pending', classification_rationale: 'Unreviewed note'}),
    withChanges({source_url: 'javascript:alert(1)', classification_rationale: 'Unsafe note'})
  ];
  const list = element('ul');
  let selected;
  const mapped = renderReviewedMapList(document, list, rows, record => {selected = record;});
  assert.equal(mapped.length, 1);
  assert.deepEqual(mapped[0].classification_rationales, [
    {note, source_url: event.source_url},
    {note: 'Different editorial rationale', source_url: other}
  ]);
  assert.match(list.children[0].children[1].textContent, /2 indexed editorial classification rationale/);
  list.children[0].children[0].listeners.click();
  for (const record of [mapped[0], selected]) {
    const panel = element('div');
    showReviewedMapSource(document, panel, record);
    assert.match(panel.children.at(-2).textContent, /not independent findings or measures of global conditions/);
    assert.match(panel.children.at(-2).textContent, /do not establish map placement/);
    const items = panel.children.at(-1).children;
    assert.equal(items[0].textContent, note + ' — Indexed under event citation: ' + event.source_url);
    assert.equal(items[1].textContent, 'Different editorial rationale — Indexed under event citation: ' + other);
    assert.equal(items[0].children.length, 0, 'markup is not parsed');
  }
});

test('classification rationale cannot substitute for location evidence or resolve conflicting categories', () => {
  const classification_rationale = 'Editorial context only';
  assert.deepEqual(reviewedMapEvents([withChanges({location_source_url: '', classification_rationale})]), []);
  assert.deepEqual(reviewedMapEvents([event, withChanges({category: 'positive', classification_rationale})]), []);
  for (const malformed of [null, {}, 42, '  ']) {
    assert.deepEqual(reviewedMapEvents([withChanges({classification_rationale: malformed})])[0].classification_rationales, []);
  }
  const list = element('ul');
  renderReviewedMapList(document, list, [event], () => {});
  assert.match(list.children[0].children[1].textContent, /No separate editorial classification rationale is indexed/);
});


test('indexed archive identifiers stay associated with their original reviewed citations', () => {
  const identifier = '<b>Archive reference 12</b>';
  const other = 'https://archive.example.gov/other#p4';
  const candidates = [
    withChanges({source_record_id: '  ' + identifier + '  '}),
    withChanges({source_record_id: identifier}),
    withChanges({source_url: other, source_record_id: identifier}),
    withChanges({review_status: 'pending', source_record_id: 'Pending record'}),
    withChanges({source_url: 'javascript:alert(1)', source_record_id: 'Unsafe record'})
  ];
  const list = element('ul');
  let selected;
  const mapped = renderReviewedMapList(document, list, candidates, record => {selected = record;});
  assert.equal(mapped.length, 1);
  assert.deepEqual(mapped[0].source_record_ids, [
    {identifier, source_url: event.source_url}, {identifier, source_url: other}
  ]);
  assert.match(list.children[0].children[1].textContent, /2 indexed document identifier/);
  list.children[0].children[0].listeners.click();
  for (const record of [mapped[0], selected]) {
    const panel = element('div');
    showReviewedMapSource(document, panel, record);
    const index = panel.children.findIndex(child => child.textContent?.includes('Indexed document identifiers'));
    assert.ok(index >= 0);
    assert.match(panel.children[index].textContent, /not independent verification or geographic evidence/);
    const items = panel.children[index + 1].children;
    assert.equal(items[0].textContent, identifier + ' — Indexed under event citation: ' + event.source_url);
    assert.equal(items[0].children.length, 0);
    assert.equal(items[1].textContent, identifier + ' — Indexed under event citation: ' + other);
    assert.equal(panel.children[4].href, event.location_source_url);
  }
});

test('document identifiers never substitute for geographic provenance', () => {
  const source_record_id = 'Archive reference 12';
  assert.deepEqual(reviewedMapEvents([withChanges({location_source_url: '', source_record_id})]), []);
  assert.deepEqual(reviewedMapEvents([event, withChanges({lon: 12, source_record_id})]), []);
  for (const invalid of [null, {}, 42, '  ']) {
    assert.deepEqual(reviewedMapEvents([withChanges({source_record_id: invalid})])[0].source_record_ids, []);
  }
  const panel = element('div');
  showReviewedMapSource(document, panel, reviewedMapEvents([event])[0]);
  assert.equal(panel.children.some(child => child.textContent?.includes('Indexed document identifiers')), false);
});


test('requires explicit well-formed citation URLs before accepting any map point', () => {
  const bad = [
    'https:archive.example.gov/report',
    'https:/archive.example.gov/report',
    'https:///archive.example.gov/report',
    'https://@archive.example.gov/report',
    'https://archive.example.gov\\report',
    'https://archive.example.gov/\nreport',
    ' https://archive.example.gov/report',
    'https://archive.example.gov/report with space',
    'https://archive.example.gov/\u0000report',
    'https://?x=1',
    'https://#x'
  ];
  for (const url of bad) {
    assert.deepEqual(reviewedMapEvents([withChanges({source_url: url})]), [], url);
    assert.deepEqual(reviewedMapEvents([withChanges({location_source_url: url})]), [], url);
  }
  const original = 'https://archive.example.gov/a%20b?doc=ID%2F12#p3';
  const location = 'https://archive.example.gov/map?ref=23#location';
  const [record] = reviewedMapEvents([withChanges({source_url: original, location_source_url: location})]);
  assert.equal(record.source_url, original);
  assert.equal(record.location_source_url, location);
});

test('does not repair malformed supplemental or counterevidence URLs into clickable citations', () => {
  const bad = ['https:archive.example.gov/lead', 'https://@archive.example.gov/lead',
    'https://archive.example.gov/lead\n', 'https:///archive.example.gov/lead'];
  const extra = 'https://archive.example.gov/context?record=5#p2';
  const counter = 'https://archive.example.gov/competing?record=6#p4';
  const list = element('ul');
  let selected;
  const [record] = renderReviewedMapList(document, list, [withChanges({
    additional_source_urls: [...bad, extra], counterevidence_urls: [...bad, counter]
  })], value => {selected = value;});
  list.children[0].children[0].listeners.click();
  for (const item of [record, selected]) {
    assert.deepEqual(item.additional_source_urls, [extra]);
    assert.deepEqual(item.counterevidence_urls, [counter]);
  }
});


test('visible inspection labels distinguish case and whitespace variants only for eligible distinct events', () => {
  const second = withChanges({id: 'archive-02', title: 'REVIEWED   documented event'});
  const third = withChanges({id: 'archive-03', title: 'Different event'});
  const pending = withChanges({id: 'archive-04', title: third.title, review_status: 'pending'});
  const duplicate = withChanges({title: event.title});
  const list = element('ul');
  let selected;
  const records = renderReviewedMapList(document, list,
    [event, second, third, pending, duplicate], record => {selected = record;});
  assert.equal(records.length, 3);
  const buttons = list.children.map(item => item.children[0]);
  assert.equal(buttons[0].textContent, 'Inspect ' + event.title + ' (Event ID: archive-01)');
  assert.equal(buttons[1].textContent, 'Inspect ' + second.title + ' (Event ID: archive-02)');
  assert.equal(buttons[2].textContent, 'Inspect ' + third.title);
  buttons[1].listeners.click();
  assert.equal(selected.id, 'archive-02');
  assert.equal(buttons[1].getAttribute('aria-expanded'), 'true');
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'false');
});


test('focused provenance region announces the current canonical event and offers a heading', () => {
  const detail = element('div');
  const labelsAtFocus = [];
  detail.focus = () => labelsAtFocus.push(detail.getAttribute('aria-label'));
  const second = withChanges({id: 'archive-02', title: event.title});
  const [firstRecord, secondRecord] = reviewedMapEvents([event, second]);
  for (const record of [firstRecord, secondRecord]) {
    inspectReviewedMapSource(document, detail, record);
    assert.equal(detail.children[0].textContent, event.title);
    assert.equal(detail.children[0].getAttribute('role'), 'heading');
    assert.equal(detail.children[0].getAttribute('aria-level'), '3');
    assert.equal(detail.children[2].href, event.source_url);
    assert.equal(detail.children[4].href, event.location_source_url);
  }
  assert.deepEqual(labelsAtFocus, [
    'Selected map event source and location evidence: ' + event.title + ' (Event ID: archive-01)',
    'Selected map event source and location evidence: ' + event.title + ' (Event ID: archive-02)'
  ]);
});


test('selected map event has a non-color visual cue driven by the existing expanded state', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /#reviewed-globe-events > li > button\[aria-expanded="true"\]\{border:3px double #a8e6cb;padding:8px 10px\}/);
  const list = element('ul');
  renderReviewedMapList(document, list, [event, withChanges({id: 'archive-02'})], () => {});
  const buttons = list.children.map(item => item.children[0]);
  assert.ok(buttons.every(button => button.getAttribute('aria-expanded') === 'false'));
  buttons[0].listeners.click();
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'true');
  assert.equal(buttons[1].getAttribute('aria-expanded'), 'false');
  buttons[1].listeners.click();
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'false');
  assert.equal(buttons[1].getAttribute('aria-expanded'), 'true');
});


test('location-document reuse is disclosed even when it is indexed as an alternate event citation', () => {
  const primary = withChanges({source_url: 'https://archive.example.gov/announcement'});
  const alternate = withChanges({source_url: 'https://archive.example.gov/report?id=12#another-page'});
  const unrelated = withChanges({source_url: 'https://archive.example.gov/report?id=13#another-page'});
  const list = element('ul');
  const [record] = renderReviewedMapList(document, list, [primary, alternate, unrelated], () => {});
  assert.equal(record.location_cites_same_document, false);
  assert.equal(record.location_cites_alternate_document, true);
  assert.equal(record.alternate_sources.length, 2);
  assert.match(list.children[0].children[1].textContent, /Location document also indexed as an alternate event citation; not independent corroboration/);
  const panel = element('div');
  showReviewedMapSource(document, panel, record);
  assert.match(panel.children[3].textContent, /reuses a document indexed as an alternate event citation/);
  assert.equal(panel.children[2].href, primary.source_url);
  assert.equal(panel.children[4].href, event.location_source_url);
  const [reverse] = reviewedMapEvents([alternate, primary, unrelated]);
  assert.equal(reverse.location_cites_same_document, true);
  assert.equal(reviewedMapEvents([primary, unrelated])[0].location_cites_alternate_document, false,
    'different document query parameters must not be treated as the same document');
  assert.equal(reviewedMapEvents([primary, {...alternate, review_status: 'pending'}])[0].location_cites_alternate_document, false);
});


test('compact globe status explicitly announces complete selection context', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="geo-panel" role="status" aria-atomic="true"/);
});

test('globe canvas identifies the equivalent source inspection list without pointer interaction', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const canvas = html.match(/<canvas\b[^>]*\bid="earth"[^>]*>/)?.[0];
  assert.ok(canvas, 'interactive globe canvas exists');
  assert.match(canvas, /aria-describedby="reviewed-globe-description"/);
  assert.equal((html.match(/id="reviewed-globe-description"/g) || []).length, 1);
  assert.match(html, /<p id="reviewed-globe-description">Use the reviewed map event list below to inspect source evidence without rotating or zooming the globe\./);
  assert.match(html, /id="reviewed-globe-events"/);
});


test('indexed date is labeled consistently in the list, compact preview and full evidence detail', () => {
  const list = element('ul'), detail = element('div'), compact = element('div');
  detail.focus = () => {};
  const candidate = withChanges({date_basis: 'Official report publication date; physical activity date not established'});
  renderReviewedMapList(document, list, [candidate], record =>
    inspectReviewedMapSource(document, detail, record, undefined, compact));
  assert.match(list.children[0].children[1].textContent, /Indexed date: 2024-02-29/);
  list.children[0].children[0].listeners.click();
  assert.match(compact.textContent, /Indexed date: 2024-02-29/);
  assert.match(detail.children[1].textContent, /Indexed date: 2024-02-29/);
  assert.match(detail.children[1].textContent, /physical activity date not established/);
  assert.doesNotMatch(detail.children[1].textContent, /· Event: /);
});

test('feed contract distinguishes the indexed event date from underlying activity dates', () => {
  const feed = JSON.parse(readFileSync(new URL('../global-evidence-pulse.json', import.meta.url), 'utf8'));
  assert.match(feed.event_contract.event_date, /date of the indexed event itself/);
  assert.match(feed.event_contract.event_date, /report, approval or disclosure that is itself the event/);
  assert.match(feed.event_contract.event_date, /not an inferred date of underlying activity/);
  assert.match(feed.event_contract.event_date, /explain the basis in date_basis/);
  assert.ok(feed.event_contract.optional_fields.includes('date_basis'));
});

test('feed contract keeps non-geographic events off the map without requiring invented coordinates for counting', () => {
  const feed = JSON.parse(readFileSync(new URL('../global-evidence-pulse.json', import.meta.url), 'utf8'));
  for (const key of ['lat', 'lon']) {
    assert.match(feed.event_contract[key], /Required for globe pins only/);
    assert.match(feed.event_contract[key], /Omit or use null for non-geographic records/);
  }
  assert.ok(feed.review_policy.some(rule => /must remain off the globe/.test(rule) &&
    /pending integration/.test(rule)), 'do not advertise unfinished Pulse eligibility as implemented');
  assert.ok(!feed.review_policy.includes('Require a specific occurrence, place, date, and source.'));
  for (const changes of [{lat: null, lon: null}, {lat: undefined, lon: undefined},
      {lat: null}, {lon: undefined}]) {
    const candidate = withChanges(changes);
    const list = element('ul');
    assert.deepEqual(reviewedMapEvents([candidate]), []);
    assert.deepEqual(renderReviewedMapList(document, list, [candidate], () => {}), []);
    assert.equal(list.children.length, 0);
  }
});

test('accessible event list exposes the same reviewed coordinates before opening evidence', () => {
  const list = element('ul');
  const valid = renderReviewedMapList(document, list, [
    event,
    withChanges({id: 'unmapped-policy', lat: null, lon: null, location_role: 'announcement_city_only'}),
    withChanges({id: 'pending-site', review_status: 'pending'})
  ], () => {});
  assert.equal(valid.length, 1);
  assert.equal(list.children.length, 1);
  const [button, context] = list.children[0].children;
  assert.equal(button.getAttribute('aria-describedby'), context.id);
  assert.match(context.textContent, /Displayed map point: 37\.7° latitude, -122\.4° longitude/);
  assert.ok(context.textContent.includes(event.location_note));
  const panel = element('div');
  showReviewedMapSource(document, panel, valid[0]);
  assert.match(panel.children[3].textContent, /Displayed map point: 37\.7° latitude, -122\.4° longitude/);
});


test('actual marker construction uses only independently validated map records, not countable or raw events', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const markerLine = html.split('\n').find(line => line.includes('const markerMeshes=[];'));
  assert.ok(markerLine, 'actual homepage marker construction exists');
  const candidates = [
    event,
    withChanges({id: 'countable-policy', lat: null, lon: null, location_source_url: null}),
    withChanges({id: 'missing-provenance', location_source_url: null}),
    withChanges({id: 'conflicted-location'}),
    withChanges({id: 'conflicted-location', lon: -121.1}),
    withChanges({id: 'pending-site', review_status: 'pending'})
  ];
  const list = element('ul');
  const mapRecords = renderReviewedMapList(document, list, candidates, () => {});
  // Simulate a future count collection that includes non-geographic records
  // and has already deduplicated conflicts. It must never drive marker creation.
  const reviewedEvents = candidates.slice(0, 4);
  const markerObjects = [];
  const THREE = {
    Vector3: class {constructor(x,y,z) {Object.assign(this,{x,y,z});}},
    SphereGeometry: class {},
    MeshBasicMaterial: class {},
    Mesh: class {constructor() {this.userData={};this.position={copy: point => {this.point=point;}};}}
  };
  const buildMarkers = new Function('THREE', 'globe', 'mapRecords', 'reviewedEvents',
    'mapEventCandidates', markerLine + '\nreturn markerMeshes;');
  const pins = buildMarkers(THREE, {add: pin => markerObjects.push(pin)}, mapRecords, reviewedEvents, candidates);
  assert.deepEqual(mapRecords.map(record => record.id), ['archive-01']);
  assert.equal(list.children.length, 1);
  assert.equal(pins.length, 1);
  assert.deepEqual(markerObjects, pins);
  assert.equal(pins[0].userData.event, mapRecords[0]);
  assert.ok(Object.values(pins[0].point).every(Number.isFinite));
  // An empty map-eligible collection must yield no markers even when counts exist.
  assert.deepEqual(buildMarkers(THREE, {add: () => assert.fail('unexpected map pin')},
    [], reviewedEvents, candidates), []);
});


test('source link lists retain visible citation labels and distinguish the selected event by canonical identity', () => {
  const panel = element('div');
  const records = reviewedMapEvents([event, withChanges({id: 'archive-02'})], Date.parse('2026-11-24T12:00:00Z'));
  assert.equal(records.length, 2);
  const labels = [];
  for (const record of records) {
    showReviewedMapSource(document, panel, record);
    const original = panel.children[2], geographic = panel.children[4];
    assert.equal(original.href, record.source_url);
    assert.equal(geographic.href, record.location_source_url);
    for (const link of [original, geographic]) {
      assert.ok(link.getAttribute('aria-label').startsWith(link.textContent));
      assert.ok(link.getAttribute('aria-label').includes('Event ID: ' + record.id));
      assert.ok(link.getAttribute('aria-label').includes(record.title));
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
    }
    labels.push(original.getAttribute('aria-label'));
    assert.notEqual(original.getAttribute('aria-label'), geographic.getAttribute('aria-label'));
  }
  assert.notEqual(labels[0], labels[1]);
});
