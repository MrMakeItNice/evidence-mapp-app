const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const homepage = fs.readFileSync(path.join(__dirname, '..', 'homepage-v2-preview.html'), 'utf8');
const reader = fs.readFileSync(path.join(__dirname, '..', 'investigation-reader.html'), 'utf8');

test('magazine section navigation resolves to real homepage targets', () => {
  const nav = homepage.match(/<nav class="edition-links edition-nav"[^>]*>([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'Magazine section navigation must exist');
  const targets = [...nav[1].matchAll(/href="#([^"]+)"/g)].map(match => match[1]);
  assert.ok(targets.length >= 4, 'Expected cover, news, investigations and corrections links');
  for (const id of targets) {
    assert.match(homepage, new RegExp('id="' + id + '"'), 'Missing magazine target: ' + id);
  }
});

test('magazine investigation links use supported reader story keys', () => {
  const links = [...homepage.matchAll(/data-edition-story[^>]*href="\.\/investigation-reader\.html\?story=([^"&]+)"/g)].map(match => match[1]);
  assert.ok(links.length >= 3, 'Expected linked investigation stories');
  for (const key of links) {
    assert.match(reader, new RegExp('(?:^|\\n)' + key + ':\\s*\\{'), 'Reader does not support story: ' + key);
  }
});
