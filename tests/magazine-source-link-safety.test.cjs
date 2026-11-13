// Run: node --test tests/magazine-source-link-safety.test.cjs
// Editorial link safety contract; no network requests or claims verification.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'homepage-v2-preview.html'), 'utf8');
const magazine = html.match(/<section\b[^>]*class="[^"]*magazine[^"]*"[^>]*>[\s\S]*?<\/section>/i)?.[0] || html;
const sourceGroups = [...magazine.matchAll(/<p\s+class="edition-links"[^>]*>([\s\S]*?)<\/p>/gi)];

test('current-news edition contains source-link groups', () => {
  assert.ok(sourceGroups.length >= 4, 'Expected source links for cover and news stories');
});

test('all editorial source links have safe, explicit destinations', () => {
  for (const [, group] of sourceGroups) {
    const anchors = [...group.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>/gi)];
    assert.ok(anchors.length, 'Source group must contain a link');
    for (const [, href] of anchors) {
      assert.ok(
        /^https:\/\/[a-z0-9.-]+(?:[/:?#]|$)/i.test(href) ||
          /^\.\/[a-z0-9._/?#=&%-]+$/i.test(href),
        `Unsafe or ambiguous editorial source destination: ${href}`
      );
    }
    assert.ok(anchors.some(([, href]) => /^https:\/\//i.test(href)),
      'Every source group needs at least one original external HTTPS citation');
  }
});
