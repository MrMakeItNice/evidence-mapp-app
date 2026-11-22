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
    validationMessage: '', validityReports: 0,
    setCustomValidity(message) { this.validationMessage = message; },
    reportValidity() { this.validityReports++; return !this.validationMessage; },
    textContent: '', value: '', hidden: id === 'globe-explore-panel', children: [],
    addEventListener(type, fn) { this[type] = fn; },
    replaceChildren(...nodes) { this.children = nodes; },
    append(node) { this.children.push(node); },
    focus() { document.activeElement = this; }
  }]));
  const stateClasses = new Set();
  const globeArea = {
    classList: {
      add: name => stateClasses.add(name),
      remove: name => stateClasses.delete(name),
      contains: name => stateClasses.has(name)
    }
  };
  elements['globe-explore-panel'].closest = selector => {
    assert.equal(selector, '.globe-area');
    return globeArea;
  };
  const quickTopics = ['Rabbit Holes', 'Case Files', 'Declassified records', 'Connections'].map(label => ({
    dataset: { globeTopic: label },
    addEventListener(type, fn) { this[type] = fn; }
  }));
  const form = elements['globe-explore-form'];
  form.querySelectorAll = selector => {
    assert.equal(selector, '[data-globe-topic]');
    return quickTopics;
  };
  form.requestSubmit = () => {
    // Native constraint validation blocks submit events while a custom error remains.
    if (!elements['globe-explore-query'].validationMessage) form.submit({ preventDefault() {} });
  };
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
  return { elements, submit, document, quickTopics, globeArea };
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

test('mobile-friendly research shortcuts follow the same accessible lens path', () => {
  assert.match(html, /class="globe-explore-shortcuts" role="group" aria-label="Common research lenses"/);
  assert.match(html, /\.globe-explore-shortcuts button\{[^}]*min-height:44px/);
  assert.match(html, /\.globe-explore-shortcuts button:focus-visible/);
  const { elements, document, quickTopics } = setup();
  const paths = ['./rabbit-hole.html', './discover.html', './paper-trails.html', './connection-explorer.html'];
  for (const [i, button] of quickTopics.entries()) {
    assert.ok(html.includes('type="button" data-globe-topic="' + button.dataset.globeTopic + '"'));
    button.click();
    assert.equal(elements['globe-explore-query'].value, button.dataset.globeTopic);
    assert.equal(elements['globe-explore-panel'].hidden, false);
    assert.equal(elements['globe-explore-links'].children[0].href, paths[i]);
    assert.equal(document.activeElement, elements['globe-explore-panel']);
  }
});

test('whitespace-only submission explains the missing topic and focuses search', () => {
  const { elements, submit, document } = setup();
  submit(' \t  ');
  const input = elements['globe-explore-query'];
  assert.equal(input.validationMessage, 'Enter a topic or choose a research shortcut.');
  assert.equal(input.validityReports, 1);
  assert.equal(document.activeElement, input);
  assert.equal(elements['globe-explore-panel'].hidden, true);
  assert.equal(elements['globe-explore-links'].children.length, 0);
});

test('editing an invalid topic clears native validation and permits the next submission', () => {
  const { elements, submit, document } = setup();
  submit('   ');
  const input = elements['globe-explore-query'];
  input.value = 'MKULTRA';input.input();
  assert.equal(input.validationMessage, '');
  elements['globe-explore-form'].requestSubmit();
  assert.equal(elements['globe-explore-panel'].hidden, false);
  assert.equal(document.activeElement, elements['globe-explore-panel']);
  assert.equal(elements['globe-explore-links'].children[0].href, './global-search.html?q=MKULTRA');
});

test('each shortcut clears an earlier custom error before requesting native submission', () => {
  for (let i = 0; i < 4; i++) {
    const { elements, submit, document, quickTopics } = setup();
    submit('   ');
    assert.ok(elements['globe-explore-query'].validationMessage);
    quickTopics[i].click();
    assert.equal(elements['globe-explore-query'].validationMessage, '');
    assert.equal(elements['globe-explore-query'].value, quickTopics[i].dataset.globeTopic);
    assert.equal(elements['globe-explore-panel'].hidden, false);
    assert.equal(document.activeElement, elements['globe-explore-panel']);
  }
});

test('mobile research lens reflows before the globe and restores the original layout when closed', () => {
  const { elements, submit, globeArea } = setup();
  assert.equal(globeArea.classList.contains('globe-lens-open'), false);
  submit('Rabbit Holes');
  assert.equal(globeArea.classList.contains('globe-lens-open'), true);
  assert.equal(elements['globe-explore-panel'].hidden, false);
  elements['globe-explore-close'].click();
  assert.equal(globeArea.classList.contains('globe-lens-open'), false);
  assert.equal(elements['globe-explore-panel'].hidden, true);
  submit('Case Files');
  assert.equal(globeArea.classList.contains('globe-lens-open'), true);

  assert.match(html, /@media\(max-width:800px\)\{\s*\.globe-explore-panel\{position:static;grid-row:8/);
  for (const [selector, row] of [
    ['globe-explore-panel', 2], ['globe-viewport', 3],
    ['globe-tools', 4], ['globe-hint', 5], ['globe-status', 6],
    ['geo-panel', 7], ['globe-cta', 8]
  ]) {
    assert.ok(html.includes('.globe-area.globe-lens-open .' + selector + '{grid-row:' + row + '}'),
      'open mobile lens must place ' + selector + ' in row ' + row);
  }
});

test('globe search preserves long topics rather than creating misleading truncated searches', () => {
  assert.doesNotMatch(html, /id="globe-explore-query"[^>]*maxlength=/);
  assert.match(html, /id="globe-explore-help"[^>]*>[^<]*up to 160 characters/);

  const { elements, submit, document, globeArea } = setup();
  submit('Rabbit Holes');
  assert.equal(elements['globe-explore-panel'].hidden, false);
  const query = 'government archive record ' + 'x'.repeat(170);
  submit(query);
  assert.equal(elements['globe-explore-query'].value, query, 'original terms must not be clipped');
  assert.match(elements['globe-explore-query'].validationMessage, /160 characters or fewer/);
  assert.match(elements['globe-explore-query'].validationMessage, /not shortened/);
  assert.equal(elements['globe-explore-panel'].hidden, true, 'stale prior lens must close');
  assert.equal(elements['globe-explore-links'].children.length, 0);
  assert.equal(globeArea.classList.contains('globe-lens-open'), false);
  assert.equal(document.activeElement, elements['globe-explore-query']);
  assert.match(elements['globe-explore-status'].textContent, /not shortened/);

  elements['globe-explore-query'].value = 'MKULTRA';
  elements['globe-explore-query'].input();
  assert.equal(elements['globe-explore-query'].validationMessage, '');
  elements['globe-explore-form'].requestSubmit();
  assert.equal(elements['globe-explore-panel'].hidden, false);
  assert.equal(elements['globe-explore-links'].children[0].href, './global-search.html?q=MKULTRA');
});

test('globe search permits up to 160 whole Unicode characters without cutting identifiers', () => {
  const { elements, submit } = setup();
  const valid = '🙂'.repeat(160);
  submit(valid);
  assert.equal(elements['globe-explore-panel'].hidden, false);
  assert.equal(elements['globe-explore-links'].children[0].href,
    './global-search.html?q=' + encodeURIComponent(valid));
  const invalid = valid + '🙂';
  submit(invalid);
  assert.equal(elements['globe-explore-panel'].hidden, true);
  assert.equal(elements['globe-explore-query'].value, invalid);
  assert.match(elements['globe-explore-query'].validationMessage, /160 characters/);
});

test('blank search after an open lens does not leave stale research destinations visible', () => {
  const { elements, submit, globeArea } = setup();
  submit('Case Files');
  assert.equal(elements['globe-explore-links'].children.length, 3);
  submit('  ');
  assert.equal(elements['globe-explore-panel'].hidden, true);
  assert.equal(elements['globe-explore-links'].children.length, 0);
  assert.equal(globeArea.classList.contains('globe-lens-open'), false);
  assert.equal(elements['globe-explore-query'].validationMessage,
    'Enter a topic or choose a research shortcut.');
});
