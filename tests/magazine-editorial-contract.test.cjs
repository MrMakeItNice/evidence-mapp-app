'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'homepage-v2-preview.html'), 'utf8');
const magazine = html.match(/<section class="magazine"\b[\s\S]*?<\/section>\s*<\/section>/)?.[0] || html.slice(html.indexOf('<section class="magazine"'), html.indexOf('<section class="magazine"') + 16000);

test('magazine has a unique, unobstructed masthead', () => {
  assert.equal((html.match(/id="magazine-title"/g) || []).length, 1);
  assert.match(magazine, /class="magazine-name"[^>]*>THE EVIDENCE<\/h2>/);
  assert.doesNotMatch(magazine.slice(0, 600), /deep[ -]?dive/i);
});

test('positive cover story has a dated, attributable source', () => {
  const cover = html.match(/<article class="edition-cover"[^>]*>[\s\S]*?<\/article>/)?.[0];
  assert.ok(cover, 'missing cover');
  assert.match(cover, /<time datetime="\d{4}-\d{2}-\d{2}"/);
  assert.match(cover, /class="edition-links"[^>]*>[\s\S]*?href="https:\/\//);
  assert.doesNotMatch(cover, /href="(?:javascript:|data:)/i);
});

test('each news story has a date and an attributable external source', () => {
  const section = html.split('<ol class="edition-news">')[1]?.split('</ol>')[0];
  assert.ok(section, 'missing news list');
  const items = section.match(/<li class="edition-item"[\s\S]*?<\/li>/g) || [];
  assert.ok(items.length >= 1, 'missing news stories');
  for (const [index, item] of items.entries()) {
    assert.match(item, /<time datetime="\d{4}-\d{2}-\d{2}"/, 'undated story ' + index);
    assert.match(item, /class="edition-links"[^>]*>[\s\S]*?href="https:\/\//, 'no external source for story ' + index);
    assert.doesNotMatch(item, /href="(?:javascript:|data:)/i);
  }
});
