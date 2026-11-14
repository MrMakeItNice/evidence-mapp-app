import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Source-contract regression coverage for stacked globe inspector fixes.
// These checks do not replace a real browser / screen-reader smoke test.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const marker = html.slice(html.indexOf('if(markerHit){'), html.indexOf('if(!hit)return;', html.indexOf('if(markerHit){')));

test('marker inspector does not assert unverified source review', () => {
  assert.ok(marker.startsWith('if(markerHit){'), 'marker inspector block must exist');
  assert.match(marker, /Source provided \(review status unverified\)/);
  assert.doesNotMatch(marker, /Source reviewed/);
});

test('marker source link uses an HTTP(S) allowlist and safe external-link attributes', () => {
  assert.match(marker, /new URL\(event\.source_url\)/);
  assert.match(marker, /\["https:","http:"\]\.includes\(url\.protocol\)/);
  assert.match(marker, /link\.href=safeSourceUrl/);
  assert.doesNotMatch(marker, /link\.href=event\.source_url/);
  assert.match(marker, /link\.rel="noopener noreferrer"/);
  assert.match(marker, /Source link unavailable or invalid/);
});

test('marker source link identifies the event to assistive technology', () => {
  assert.match(marker, /link\.setAttribute\("aria-label","Read original source for "\+event\.title\+" \(opens in a new tab\)"\)/);
  assert.match(marker, /heading\.textContent=event\.title/);
});
