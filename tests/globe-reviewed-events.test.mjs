import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedMapEvents, showReviewedMapSource, renderReviewedMapList} from '../globe-reviewed-events.mjs';

const event = {id: 'archive-01', title: 'Reviewed documented event', category: 'neutral',
  event_date: '2024-02-29', lat: 37.7, lon: -122.4,
  source_url: 'https://archive.example.gov/report?id=12#p3',
  location_source_url: 'https://archive.example.gov/report?id=12#location',
  location_note: 'Reported city center; approximate map position, not a street address',
  review_status: 'verified'};
const withChanges = changes => ({...event, ...changes});

function element(tag) {
  return {tag, children: [], listeners: {}, replaceChildren(...children) {this.children = children;},
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

test('deduplicates identifiers; no feed produces an empty list', () => {
  assert.deepEqual(reviewedMapEvents(null), []);
  assert.deepEqual(reviewedMapEvents([]), []);
  assert.equal(reviewedMapEvents([event, withChanges({title: 'Copy'})]).length, 1);
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
