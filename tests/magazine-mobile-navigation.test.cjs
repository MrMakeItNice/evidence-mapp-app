'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'investigation-reader.html'), 'utf8');

test('mobile header brand and main navigation share a 44px tap-height rule', () => {
  assert.match(html, /@media\(max-width:800px\)\{header nav a,header \.brand\{display:inline-flex;align-items:center;min-height:44px\}\}/);
});
test('brand remains a navigable home link and existing destinations are retained', () => {
  assert.match(html, /<a class="brand" href="\.\/homepage-v2-preview\.html">/);
  for (const path of ['./global-search.html','./discover.html','./paper-trails.html','./connection-explorer.html','./index.html?workspace=1']) {
    assert.ok(html.includes('href="' + path + '"'), 'missing navigation destination: ' + path);
  }
});
test('mobile within-issue jump and keyboard focus remain available', () => {
  assert.match(html, /\.issue-jump\{display:inline-flex;align-items:center;min-height:44px/);
  assert.match(html, /a:focus-visible,button:focus-visible/);
  assert.match(html, /id="inside-this-issue"[^>]*tabindex="-1"/);
});
test('mobile body and card columns retain responsive min-width safeguards', () => {
  assert.match(html, /\.reader\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(html, /\.reader>\.article,\.reader>\.sidebar\{min-width:0;overflow-wrap:anywhere\}/);
});
