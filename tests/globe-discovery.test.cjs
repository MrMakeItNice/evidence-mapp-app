const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'globe-explore.js'), 'utf8');

function setup() {
  const ids = ['globe-explore-form', 'globe-explore-query', 'globe-explore-panel',
    'globe-explore-title', 'globe-explore-summary', 'globe-explore-links', 'globe-explore-status', 'globe-explore-close'];
  const elements = Object.fromEntries(ids.map(id => [id, {
    textContent: '', value: '', hidden: id === 'globe-explore-panel', children: [],
    addEventListener(type, fn) { this[type] = fn; },
    replaceChildren(...nodes) { this.children = nodes; },
    append(node) { this.children.push(node); },
    focus() { document.activeElement = this; }
  }]));
  const document = {
    getElementById: id => elements[id] || null,
    createElement: tag => ({ tag, href: '', textContent: '' })
  };
  vm.runInNewContext(js, { document, encodeURIComponent });
  const submit = term => {
    elements['globe-explore-query'].value = term;
    let prevented = false;
    elements['globe-explore-form'].submit({ preventDefault() { prevented = true; } });
    assert.ok(prevented, 'form submits without a page reload');
    return elements;
  };
  return { elements, submit, document };
}

test('accessible search panel and deferred script exist on the globe homepage', () => {
  for (const id of ['globe-explore-form', 'globe-explore-query', 'globe-explore-panel',
    'globe-explore-title', 'globe-explore-summary', 'globe-explore-links', 'globe-explore-status']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing ' + id);
  }
  assert.match(html, /src="\.\/globe-explore\.js" defer/);
  assert.match(html, /type="search"[^>]*id="globe-explore-query"|id="globe-explore-query"[^>]*type="search"/);
  assert.match(html, /id="globe-explore-status"[^>]*role="status"/);
});

test('Rabbit Holes opens the documented discovery lens, not invented map pins', () => {
  const e = setup().submit('Rabbit holes');
  assert.equal(e['globe-explore-panel'].hidden, false);
  assert.match(e['globe-explore-title'].textContent, /Rabbit Holes/);
  assert.deepEqual(Array.from(e['globe-explore-links'].children, a => a.href),
    ['./rabbit-hole.html', './discover.html', './evidence-board.html']);
  assert.match(e['globe-explore-summary'].textContent, /does not prove a connection/);
});

test('Case Files, declassified records, and connections navigate to existing sections', () => {
  for (const [term, firstHref] of [
    ['CASE FILES', './discover.html'],
    ['declassified records', './paper-trails.html'],
    ['relationship map', './connection-explorer.html']
  ]) {
    const e = setup().submit(term);
    assert.equal(e['globe-explore-links'].children[0].href, firstHref);
  }
});

test('custom topics use encoded same-site search links and never create HTML', () => {
  const e = setup().submit('  MKULTRA   &  archives ');
  assert.equal(e['globe-explore-links'].children[0].href,
    './global-search.html?q=MKULTRA%20%26%20archives');
  assert.match(e['globe-explore-links'].children[0].textContent, /MKULTRA/);
  const malicious = setup().submit('<img src=x onerror=alert(1)>');
  assert.ok(malicious['globe-explore-links'].children[0].href.includes('%3Cimg'));
  assert.equal(typeof malicious['globe-explore-links'].children[0].textContent, 'string');
});

test('blank input leaves the panel closed, without external requests', () => {
  const e = setup().submit('  ');
  assert.equal(e['globe-explore-panel'].hidden, true);
  assert.equal(e['globe-explore-links'].children.length, 0);
});

test('keyboard focus follows the opened lens and Escape returns to search', () => {
  const { elements, submit, document } = setup();
  submit('Rabbit Holes');
  assert.equal(document.activeElement, elements['globe-explore-panel']);
  let prevented = false;
  elements['globe-explore-panel'].keydown({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.ok(prevented, 'Escape is handled inside the lens');
  assert.equal(elements['globe-explore-panel'].hidden, true);
  assert.equal(document.activeElement, elements['globe-explore-query']);
  assert.match(elements['globe-explore-status'].textContent, /closed/);
  submit('Case Files');
  assert.equal(elements['globe-explore-panel'].hidden, false);
  assert.equal(document.activeElement, elements['globe-explore-panel']);
});

test('the focused research lens is named by its heading and has touch-sized links', () => {
  assert.match(html, /id="globe-explore-panel"[^>]*tabindex="-1"[^>]*aria-labelledby="globe-explore-title"/);
  assert.match(html, /\.globe-explore-panel a\{[^}]*min-height:44px/);
  assert.match(html, /\.globe-explore-panel:focus-visible/);
});

test('visible close action returns to search, preserves the topic and permits reopening', () => {
  assert.match(html, /<button id="globe-explore-close"[^>]*type="button">Close research lens<\/button>/);
  const { elements, submit, document } = setup();
  submit('MKULTRA');
  elements['globe-explore-close'].click();
  assert.equal(elements['globe-explore-panel'].hidden, true);
  assert.equal(document.activeElement, elements['globe-explore-query']);
  assert.equal(elements['globe-explore-query'].value, 'MKULTRA');
  assert.match(elements['globe-explore-status'].textContent, /closed/);
  submit('Rabbit Holes');
  assert.equal(elements['globe-explore-panel'].hidden, false);
  assert.equal(document.activeElement, elements['globe-explore-panel']);
  assert.equal(elements['globe-explore-links'].children[0].href, './rabbit-hole.html');
});

test('a closed lens ignores repeated dismissal without taking focus', () => {
  const { elements, document } = setup();
  const otherControl = {};
  document.activeElement = otherControl;
  elements['globe-explore-close'].click();
  assert.equal(document.activeElement, otherControl);
  assert.equal(elements['globe-explore-status'].textContent, '');
});
