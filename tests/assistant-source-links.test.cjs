'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '..', 'assistant.js'), 'utf8');
function functionLine(name) {
  const line = code.split(/\r?\n/).find(value => value.startsWith('function ' + name + '('));
  assert.ok(line, 'missing ' + name + ' function');
  return line;
}
function validator() {
  const context = { URL };
  vm.runInNewContext(functionLine('safeSourceLink'), context);
  return context.safeSourceLink;
}
class FakeElement {
  constructor(tagName) { this.tagName = tagName; this.children = []; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  remove() {}
  get firstElementChild() { return this.children[0] || null; }
}
function renderSources(sources, notice = '') {
  const messages = new FakeElement('div');
  const content = { scrollHeight: 50, scrollTop: 0 };
  const context = {
    URL,
    document: { createElement: tag => new FakeElement(tag) },
    messages,
    by: () => content
  };
  vm.runInNewContext(functionLine('safeSourceLink') + '\n' + functionLine('message'), context);
  context.message('SOURCE FINDER', 'Evidence summary', sources, notice);
  const article = messages.children[0];
  return { article, links: article.children.filter(child => child.tagName === 'a') };
}

test('Ask Evidence script is syntactically valid', () => {
  assert.doesNotThrow(() => new vm.Script(code));
});
test('preserves safe archival query identifiers and fragments', () => {
  const check = validator();
  const uri = 'https://www.archives.gov/record.pdf?document=ABC%2F123#page=4';
  assert.equal(check(uri)?.href, uri);
  assert.equal(check('http://records.example.org/a')?.host, 'records.example.org');
});
test('blocks impersonation, userinfo, non-web, malformed and ambiguous URLs', () => {
  const check = validator();
  const blocked = [
    'https://archives.gov@attacker.example/file',
    'https://user:secret@archives.gov/file',
    'javascript:alert(1)',
    'data:text/plain,source',
    String.raw`https://archives.gov\@attacker.example/file`,
    'https://archives.gov/\nfile',
    ' https://archives.gov/file',
    'https://archives.gov/file ',
    'not a URL',
    null,
    17
  ];
  for (const url of blocked) assert.equal(check(url), null, 'should block ' + String(url));
});
test('shows actual destination host and marks source links as indexed', () => {
  const { links } = renderSources([
    { id: 'CIA-123', title: 'Source title', url: 'https://www.archives.gov/record.pdf?item=9#page=2' }
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].href, 'https://www.archives.gov/record.pdf?item=9#page=2');
  assert.match(links[0].textContent, /CIA-123.*Source title.*www\.archives\.gov.*indexed link.*new tab/);
  assert.equal(links[0].target, '_blank');
  assert.equal(links[0].rel, 'noopener noreferrer');
  assert.equal(links[0].referrerPolicy, 'no-referrer');
});
test('filters deceptive links while retaining the answer and notice', () => {
  const { article, links } = renderSources([
    { id: 'spoof', title: 'Official Archive', url: 'https://archives.gov@attacker.example/file' },
    { title: 'Verified destination not implied', url: 'https://archives.gov/record' },
    null,
    { url: 'javascript:alert(1)', title: 'Unsafe' }
  ], 'Review original citations.');
  assert.equal(links.length, 1);
  assert.match(links[0].textContent, /archives\.gov/);
  assert.equal(article.children[1].textContent, 'Evidence summary');
  assert.equal(article.children.at(-1).textContent, 'Review original citations.');
});
test('keeps answers visible when sources are missing or malformed', () => {
  for (const sources of [undefined, null, {}, 'not an array']) {
    const { article, links } = renderSources(sources);
    assert.equal(links.length, 0);
    assert.equal(article.children[1].textContent, 'Evidence summary');
  }
});

test('reports skipped citation links without exposing unsafe URLs or claiming authenticity', () => {
  const { article, links } = renderSources([
    { id: 'A', title: 'Archive scan', url: 'https://www.archives.gov/scan?doc=1#page=3' },
    { id: 'B', title: 'Spoofed host', url: 'https://archives.gov@unsafe.example/scan' },
    { id: 'C', title: 'URL missing' },
    null
  ]);
  assert.equal(links.length, 1);
  const warnings = article.children.filter(child => child.tagName === 'p' && /citation links were not shown/.test(child.textContent));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].textContent, /3 indexed citation links/);
  assert.match(warnings[0].textContent, /do not verify document authenticity/);
  assert.doesNotMatch(warnings[0].textContent, /unsafe\.example/);
  assert.equal(article.children[1].textContent, 'Evidence summary');

  const clean = renderSources([{ title: 'Archive scan', url: 'https://www.archives.gov/scan' }]);
  assert.equal(clean.article.children.filter(child => child.tagName === 'p').length, 1);
  const absent = renderSources(undefined);
  assert.equal(absent.article.children.filter(child => child.tagName === 'p').length, 1);
});

test('reports a single omitted link without adding a misleading zero-sources warning', () => {
  const { article, links } = renderSources([{ url: 'javascript:alert(1)', title: 'Bad link' }]);
  assert.equal(links.length, 0);
  assert.match(article.children.at(-1).textContent, /1 indexed citation link was not shown/);
});
