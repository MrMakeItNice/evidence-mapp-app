'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'investigation-reader.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'magazine reader inline JavaScript exists');

function renderStory(story) {
  const nodes = new Map();
  function element(tag) {
    return {
      tag, children: [], attributes: {}, textContent: '', className: '', href: '',
      append(...children) { this.children.push(...children); },
      setAttribute(name, value) { this.attributes[name] = value; }
    };
  }
  const document = {
    createElement: element,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, element('container'));
      return nodes.get(id);
    }
  };
  vm.runInNewContext(script, {
    document, location: { search: '?story=' + encodeURIComponent(story) }, URLSearchParams
  }, { timeout: 1000 });
  return { article: nodes.get('article'), issueLinks: nodes.get('issue-links') };
}

test('reader script parses without syntax errors', () => {
  assert.doesNotThrow(() => new vm.Script(script));
});

test('reader labels research paths as navigation rather than documentary citations', () => {
  assert.match(html, /research pathways in this edition link to related Evidence Atlas pages, not original source documents/i);
  for (const story of ['history', 'money', 'mind', 'unavailable-story']) {
    const { article } = renderStory(story);
    const byline = article.children.findIndex(node => node.className === 'byline');
    assert.ok(byline >= 0, 'byline present');
    assert.match(article.children[byline + 1].textContent, /Source status: Editorial overview/);
    assert.match(article.children[byline + 1].textContent, /No original documents are cited/);
    assert.ok(article.children.some(node => node.tag === 'h3' &&
      node.textContent === 'Research pathways (not source citations)'));
  }
});

test('all three stories retain their original research links', () => {
  const expected = {
    history: ['./shared-future.html#history', './discover.html'],
    money: ['./paper-trails.html', './connection-explorer.html'],
    mind: ['./shared-future.html#standards', './shared-future.html']
  };
  for (const [story, links] of Object.entries(expected)) {
    const { article, issueLinks } = renderStory(story);
    const header = article.children.findIndex(node =>
      node.tag === 'h3' && node.textContent === 'Research pathways (not source citations)');
    const list = article.children[header + 1];
    assert.equal(list.tag, 'ul');
    assert.deepEqual(Array.from(list.children, li => li.children[0].href), links);
    const selected = issueLinks.children.filter(node => node.attributes['aria-current'] === 'page');
    assert.equal(selected.length, 1, 'one selected magazine story');
    assert.equal(selected[0].href, '?story=' + story);
  }
});

test('each rendered article exposes its source limitation as an accessible description', () => {
  const target = html.match(/<article\b[^>]*id="article"[^>]*aria-describedby="([^"]+)"/);
  assert.ok(target, 'article references its source status');
  for (const story of ['history', 'money', 'mind', 'unavailable-story']) {
    const { article } = renderStory(story);
    const notes = article.children.filter(node => node.id === target[1]);
    assert.equal(notes.length, 1, 'one description target per rendered article');
    assert.equal(notes[0].attributes.role, 'note');
    assert.match(notes[0].textContent, /Editorial overview.*No original documents are cited/);
    assert.ok(!('tabindex' in notes[0].attributes), 'note does not add an extra Tab stop');
  }
});
