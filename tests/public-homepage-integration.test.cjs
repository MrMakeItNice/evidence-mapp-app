// Run with: node --test tests/public-homepage-integration.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const homepage = fs.readFileSync(path.join(root, 'homepage-v2-preview.html'), 'utf8');

test('public landing retains an explicit owner-workspace opt-in', () => {
  assert.match(landing, /params\.get\('workspace'\) !== '1'/);
  assert.match(landing, /window\.location\.replace\('\.\/homepage-v2-preview\.html'/);
});

test('globe feed rejects unpublished events and does not invent zero counts', () => {
  assert.match(homepage, /e\.review_status!=="verified"/);
  assert.match(homepage, /e\.source_url/);
  assert.match(homepage, /No reviewed events available yet; counts are not zero\./);
});

test('globe source links are isolated from the opener', () => {
  assert.match(homepage, /link\.rel="noopener noreferrer"/);
  assert.match(homepage, /link\.textContent="Read original source/);
});
