// Review-only regression for Evidence Board card movement without dragging.
// Run: node --test tests/evidence-board-move-controls.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const html = readFileSync(join(__dirname, '..', 'evidence-board.html'), 'utf8');

function createFixture() {
  const start = html.indexOf('function moveNode(n,dx,dy){');
  const end = html.indexOf('function drawWires(){', start);
  assert.ok(start >= 0 && end > start, 'actual movement helper exists');
  const nodes = [
    { id: 'case', item: { title: 'Case' }, x: 500, y: 340 },
    { id: 'citation', item: { title: 'Indexed citation' }, x: 300, y: 150 }
  ];
  const cards = [{ style: {} }, { style: {} }];
  const status = { textContent: '' };
  let redraws = 0;
  const context = {
    nodes,
    $: id => id === 'cards' ? { children: cards } : id === 'status' ? status : null,
    drawWires: () => { redraws += 1; }
  };
  const moveNode = vm.runInNewContext(html.slice(start, end) + ';moveNode', context);
  return { moveNode, nodes, cards, status, getRedraws: () => redraws };
}

test('inspector includes explicit click/tap/keyboard move controls', () => {
  assert.match(html, /controls\.setAttribute\('role','group'\)/);
  assert.match(html, /controls\.setAttribute\('aria-label','Move selected card without dragging'\)/);
  assert.match(html, /button\.type='button'/);
  assert.match(html, /button\.setAttribute\('aria-label','Move '/);
  assert.match(html, /button\.addEventListener\('click',\(\)=>moveNode\(n,dx,dy\)\)/);
  for (const direction of ['Up','Down','Left','Right']) {
    assert.ok(html.includes("'" + direction + "'"), direction + ' control exists');
  }
  assert.match(html, /\.move-controls button\{min-height:44px/);
  assert.match(html, /id="status" role="status"/);
});

test('moving a selected citation updates coordinates, its tile and connecting wires', () => {
  const f = createFixture();
  f.moveNode(f.nodes[1], 20, -20);
  assert.equal(f.nodes[1].x, 320);
  assert.equal(f.nodes[1].y, 130);
  assert.equal(f.cards[1].style.left, '320px');
  assert.equal(f.cards[1].style.top, '130px');
  assert.equal(f.getRedraws(), 1);
  assert.match(f.status.textContent, /Moved Indexed citation/);
  assert.match(f.status.textContent, /Save layout/);
});

test('move controls enforce the existing board bounds and explain blocked movement', () => {
  const f = createFixture();
  f.nodes[1].x = 995; f.nodes[1].y = 5;
  f.moveNode(f.nodes[1], 20, -20);
  assert.equal(f.nodes[1].x, 1000);
  assert.equal(f.nodes[1].y, 0);
  assert.equal(f.getRedraws(), 1);
  f.moveNode(f.nodes[1], 20, -20);
  assert.equal(f.getRedraws(), 1);
  assert.match(f.status.textContent, /board edge/);
  f.moveNode(f.nodes[1], -20, 20);
  assert.equal(f.nodes[1].x, 980);
  assert.equal(f.nodes[1].y, 20);
  assert.equal(f.getRedraws(), 2);
});

test('moving a stale or absent card is a no-op; existing save/pointer actions remain', () => {
  const f = createFixture();
  f.moveNode({ id: 'missing', item: { title: 'Not on board' }, x: 1, y: 1 }, 20, 0);
  assert.equal(f.getRedraws(), 0);
  assert.match(html, /card\.addEventListener\('pointermove'/);
  assert.match(html, /localStorage\.setItem\(layoutKey\(\)/);
  assert.match(html, /card\.addEventListener\('keydown'/);
});


test('long citation URLs have distinct layout IDs, even with the same first 220 characters', () => {
  const start = html.indexOf('function sourceNodeId(url){');
  const end = html.indexOf('function nodePos(', start);
  assert.ok(start >= 0 && end > start, 'stable source card ID helper exists');
  const sourceNodeId = vm.runInNewContext(html.slice(start, end) + ';sourceNodeId', { encodeURIComponent });
  const common = 'https://archives.example.gov/record?path=' + 'x'.repeat(240);
  const first = common + '&id=alpha';
  const second = common + '&id=beta';
  assert.notEqual(sourceNodeId(first), sourceNodeId(second), 'different archival links must not share saved positions');
  assert.equal(sourceNodeId(first), 'source-' + encodeURIComponent(first), 'complete URL is represented in the ID');
  assert.match(html, /id:sourceNodeId\(item\.url\)/, 'board nodes use full untruncated citation keys');
});

async function createBoard(publishedCases = [{ id: '1', title: 'Published case' }], references, failedRequest = false, savedLayout, clipboard, request, clock, navigation = {}) {
  const elements = new Map(), stored = new Map(), windowListeners = {};
  if (savedLayout !== undefined) stored.set('atlas-evidence-board-layout-v2-1', savedLayout);
  const make = tag => ({
    tag, children: [], style: {}, attributes: {}, dataset: {}, listeners: {}, textContent: '', className: '',
    focus() { document.activeElement = this; }, blur() { if (document.activeElement === this) document.activeElement = undefined; },
    captures: new Set(), setPointerCapture(id) { this.captures.add(id); }, hasPointerCapture(id) { return this.captures.has(id); },
    releasePointerCapture(id) { this.captures.delete(id); this.listeners.lostpointercapture?.({ pointerId: id }); },
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, fn) { this.listeners[name] = fn; },
    get classList() { const self = this; return {
      add(name) { self.className += ' ' + name; },
      remove(name) { self.className = self.className.split(' ').filter(v => v !== name).join(' '); }
    }; }
  });
  const get = id => { if (!elements.has(id)) elements.set(id, make('div')); return elements.get(id); };
  get('viewport').clientWidth = 1000;
  get('viewport').clientHeight = 480;
  get('save').disabled = /<button id="save"[^>]*\bdisabled/.test(html);
  get('fit-all').disabled = /<button id="fit-all"[^>]*\bdisabled/.test(html); // Initial native HTML state in the simulated DOM.
  const document = {
    title: html.match(/<title>(.*?)<\/title>/)[1],
    getElementById: get, createElement: make, createElementNS: (_, tag) => make(tag),
    querySelectorAll: () => get('cards').children
  };
  const citation = { case_id: '1', title: 'Original document', url: 'https://records.example.org/archive?id=1' };
  let opened = 0;
  const location = { hash: navigation.hash || '' }, historyCalls = [];
  const history = Object.fromEntries(['pushState','replaceState'].map(method => [method, (_, __, hash) => { historyCalls.push({ method, hash }); location.hash = hash; }]));
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    document, URL, encodeURIComponent, AbortController, setTimeout, clearTimeout, ...clock, navigator: { clipboard },
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    window: { location, history, open() { opened++; }, addEventListener(type, handler) { windowListeners[type] = handler; } },
    fetch: request || (async url => ({ ok: !failedRequest, json: async () => url.includes('paper-trails-data')
      ? { references: references ?? [citation] } : publishedCases }))
  });
  await new Promise(resolve => setImmediate(resolve));
  return { get, stored, document, citation, windowListeners, location, historyCalls, getOpened: () => opened };
}

test('rendered source inspector moves its selected card through native buttons and saves the resulting layout', async () => {
  const { get, stored, citation, getOpened } = await createBoard();
  assert.equal(get('cards').children.length, 2);
  const tile = get('cards').children[1];
  let prevented = 0;
  tile.listeners.keydown({ key: 'Enter', preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
  const inspector = get('details');
  assert.equal(inspector.children[0].textContent, citation.title);
  const sourceLink = inspector.children.find(n => n.tag === 'a');
  assert.equal(sourceLink.href, citation.url);
  const controls = inspector.children.find(n => n.className === 'move-controls');
  assert.deepEqual(controls.children.map(n => n.textContent), ['Up', 'Left', 'Right', 'Down']);
  const start = { x: parseFloat(tile.style.left), y: parseFloat(tile.style.top) };
  const expected = [[start.x, start.y - 20], [start.x - 20, start.y - 20], [start.x, start.y - 20], [start.x, start.y]];
  controls.children.forEach((button, index) => {
    assert.equal(button.type, 'button');
    button.listeners.click();
    assert.equal(parseFloat(tile.style.left), expected[index][0]);
    assert.equal(parseFloat(tile.style.top), expected[index][1]);
    assert.equal(get('details'), inspector);
    assert.equal(inspector.children.find(n => n.className === 'move-controls'), controls, 'movement must preserve inspector buttons');
    assert.match(get('status').textContent, /Moved Original document/);
  });
  get('save').listeners.click();
  const saved = JSON.parse(stored.get('atlas-evidence-board-layout-v2-1'));
  assert.deepEqual(saved['source-' + encodeURIComponent(citation.url)], start);
  assert.equal(getOpened(), 0, 'rearranging must not open a source');
});


test('Enter and Space focus the inspected heading; Escape returns to the current card', async () => {
  const { get, document } = await createBoard();
  const cards = get('cards').children;
  assert.equal(document.activeElement, undefined, 'loading must not steal focus');
  for (const [index, key] of [[1, 'Enter'], [0, ' ']]) {
    const card = cards[index]; card.focus();
    card.listeners.keydown({ key, preventDefault() {} });
    const heading = get('details').children[0];
    assert.equal(document.activeElement, heading);
    assert.equal(heading.tag, 'h2'); assert.equal(heading.tabIndex, -1);
    const controls = get('details').children.find(n => n.className === 'move-controls');
    controls.children[0].focus();
    let prevented = 0;
    get('selected-record').listeners.keydown({ key: 'Escape', preventDefault() { prevented++; } });
    assert.equal(prevented, 1); assert.equal(document.activeElement, card);
  }
});

test('pointer inspection keeps focus; ordinary and modified inspector keys are untouched', async () => {
  const { get, document } = await createBoard();
  const card = get('cards').children[1], marker = {};
  document.activeElement = marker;
  card.listeners.pointerdown({ clientX: 0, clientY: 0, pointerId: 1, button: 0, isPrimary: true, stopPropagation() {} });
  card.listeners.pointerup({ pointerId: 1 });
  assert.equal(document.activeElement, marker);
  for (const event of [{ key: 'Tab' }, { key: 'ArrowDown' }, { key: 'Escape', ctrlKey: true }, { key: 'Escape', altKey: true }, { key: 'Escape', metaKey: true }, { key: 'Escape', shiftKey: true }]) {
    get('selected-record').listeners.keydown({ ...event, preventDefault() { assert.fail('unhandled key was prevented'); } });
    assert.equal(document.activeElement, marker);
  }
  get('selected-record').listeners.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(document.activeElement, card, 'Escape returns to the pointer-inspected card too');
});


test('visual and accessible selection follow initial, keyboard and pointer inspection', async () => {
  const { get, document } = await createBoard();
  const cards = get('cards').children;
  const check = selected => {
    cards.forEach((card, index) => {
      assert.equal(card.attributes['aria-pressed'], String(index === selected));
      assert.equal(card.className.split(' ').includes('selected'), index === selected);
      assert.equal(card.attributes['aria-controls'], 'selected-record');
    });
    assert.equal(get('details').children[0].textContent, selected === 0 ? 'Published case' : 'Original document');
  };
  check(0);
  assert.equal(document.activeElement, undefined, 'initial selection must not move focus');
  cards[1].listeners.keydown({ key: 'Enter', preventDefault() {} }); check(1);
  assert.equal(document.activeElement, get('details').children[0]);
  cards[0].listeners.keydown({ key: ' ', preventDefault() {} }); check(0);
  const marker = {}; document.activeElement = marker;
  cards[1].listeners.pointerdown({ clientX: 0, clientY: 0, pointerId: 1, button: 0, isPrimary: true, stopPropagation() {} });
  cards[1].listeners.pointerup({ pointerId: 1 }); check(1);
  assert.equal(document.activeElement, marker, 'pointer selection must not move focus');
  cards[1].listeners.pointerdown({ clientX: 0, clientY: 0, pointerId: 1, button: 0, isPrimary: true, stopPropagation() {} });
  cards[1].listeners.pointerup({ pointerId: 1 }); check(1);
  get('selected-record').listeners.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(document.activeElement, cards[1]);
});


test('card guidance remains associated across inspection and save-status updates', async () => {
  const instructions = html.match(/<div class="help" id="board-instructions">([\s\S]*?)<\/div>/);
  assert.ok(instructions, 'persistent instructions are independent of the changing live status');
  assert.match(instructions[1], /<span id="card-instructions">Enter or Space opens card details\. Escape from details returns to the card\./);
  assert.match(instructions[1], /direction buttons to move a card without dragging/);
  assert.match(instructions[1], /background to pan.*Zoom or Reset/);
  assert.equal([...html.matchAll(/id="card-instructions"/g)].length, 1);
  assert.equal([...html.matchAll(/id="board-instructions"/g)].length, 1);
  assert.match(html, /id="viewport" role="group" aria-describedby="board-instructions"/);
  const { get } = await createBoard();
  for (const card of get('cards').children) {
    assert.equal(card.attributes['aria-describedby'], 'card-instructions');
    card.listeners.keydown({ key: 'Enter', preventDefault() {} });
    get('save').listeners.click();
    assert.equal(card.attributes['aria-describedby'], 'card-instructions');
    assert.match(get('status').textContent, /Layout saved/);
  }
  assert.doesNotMatch(html, /(?:\$|getElementById)\(['"](?:board|card)-instructions['"]\)/, 'status actions do not rewrite the static instruction region');
});


test('focused cards retain focus on Escape and leave modified activation/browser keys untouched', async () => {
  const { get, document } = await createBoard();
  const card = get('cards').children[1]; card.focus();
  const originalHeading = get('details').children[0];
  const events = [{ key: 'Escape' }, { key: 'Tab' }, { key: 'ArrowDown' }];
  for (const key of ['Enter', ' ']) {
    for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) events.push({ key, [modifier]: true });
  }
  for (const event of events) {
    card.listeners.keydown({ ...event, preventDefault() { assert.fail('card intercepted a non-activation key or modified shortcut'); } });
    assert.equal(document.activeElement, card, 'focus stays at the card until native browser behavior runs');
    assert.equal(get('details').children[0], originalHeading, 'shortcut must not replace the inspector');
    assert.equal(card.attributes['aria-pressed'], 'false', 'shortcut must not select the card');
  }
  let prevented = 0;
  card.listeners.keydown({ key: 'Enter', preventDefault() { prevented++; } });
  assert.equal(prevented, 1); assert.equal(card.attributes['aria-pressed'], 'true');
  assert.equal(document.activeElement, get('details').children[0]);
});


test('case navigation identifies the current case without replacing the focused button or search', async () => {
  const { get, document } = await createBoard([{ id: '1', title: 'Published case' }, { id: '2', title: 'Second investigation' }]);
  assert.deepEqual(get('cases').children.map(b => b.attributes['aria-pressed']), ['true', 'false']);
  get('search').value = 'i';
  get('search').listeners.input({ target: { value: 'i' } });
  const buttons = get('cases').children;
  buttons[1].focus();
  buttons[1].listeners.click();
  assert.equal(get('cases').children[1], buttons[1], 'selection updates existing navigation buttons');
  assert.equal(document.activeElement, buttons[1]);
  assert.equal(get('search').value, 'i');
  assert.deepEqual(buttons.map(b => b.attributes['aria-pressed']), ['false', 'true']);
  assert.equal(get('heading').textContent, 'Second investigation');
  get('search').listeners.input({ target: { value: 'Published' } });
  assert.equal(get('cases').children.length, 1);
  assert.equal(get('cases').children[0].attributes['aria-pressed'], 'false', 'a hidden current case must not mark a different match selected');
  get('search').listeners.input({ target: { value: '' } });
  assert.deepEqual(get('cases').children.map(b => b.attributes['aria-pressed']), ['false', 'true']);
  get('cases').children[0].listeners.click();
  assert.deepEqual(get('cases').children.map(b => b.attributes['aria-pressed']), ['true', 'false']);
  assert.equal(get('heading').textContent, 'Published case');
});


test('citation count discloses the display cap, excludes duplicates and unsafe URLs, and persists across layout actions', async () => {
  const references = Array.from({ length: 14 }, (_, i) => ({
    case_id: '1', title: 'Indexed citation ' + i, url: 'https://archive.example/doc?id=' + i
  }));
  references.push({ case_id: '1', url: references[0].url },
    { case_id: '1', url: 'javascript:alert(1)' },
    { case_id: '1', url: 'https://user@archive.example/doc' },
    { case_id: '2', url: 'https://archive.example/other' });
  const { get } = await createBoard([{ id: '1', title: 'Published case' },
    { id: '2', title: 'Second investigation' }, { id: '3', title: 'No indexed links' }], references);
  const count = get('citation-count');
  assert.equal(get('cards').children.length, 13, 'case card plus at most 12 citations');
  assert.equal(get('wires').children.length, 12);
  assert.match(count.textContent, /Showing 12 of 14 unique indexed citation URLs \(12-card display limit\)/);
  assert.match(count.textContent, /not counts of independently verified documents/);
  assert.ok(get('status').textContent.includes(count.textContent));
  const initial = count.textContent;
  get('cards').children[1].listeners.keydown({ key: 'Enter', preventDefault() {} });
  get('details').children.find(n => n.className === 'move-controls').children[0].listeners.click();
  get('save').listeners.click();
  assert.equal(count.textContent, initial, 'movement and saving must not erase the citation disclosure');
  get('cases').children[1].listeners.click();
  assert.equal(get('cards').children.length, 2);
  assert.match(count.textContent, /Showing 1 of 1 unique indexed citation URLs/);
  assert.doesNotMatch(count.textContent, /12-card display limit/);
  get('cases').children[2].listeners.click();
  assert.equal(get('cards').children.length, 1);
  assert.equal(get('wires').children.length, 0);
  assert.match(count.textContent, /No eligible indexed citation URLs/);
  assert.match(count.textContent, /does not establish that no evidence exists/);
});


// Consolidate #313/#315 against the current accessible inspector.
function pointer(pointerId = 1, overrides = {}) {
  return { pointerId, button: 0, isPrimary: true, clientX: 0, clientY: 0,
    target: { closest: () => null }, stopPropagation() {}, ...overrides };
}
test('secondary and non-main-button starts do not drag, select, or pan', async () => {
  const { get } = await createBoard();
  const card = get('cards').children[1], view = get('viewport'), world = get('world');
  const left = card.style.left, transform = world.style.transform;
  for (const bad of [pointer(1, { button: 2 }), pointer(2, { isPrimary: false })]) {
    for (const target of [card, view]) {
      target.listeners.pointerdown(bad);
      target.listeners.pointermove({ ...bad, clientX: 50 });
      target.listeners.pointerup(bad);
    }
  }
  assert.equal(card.style.left, left);
  assert.equal(world.style.transform, transform);
  assert.equal(card.attributes['aria-pressed'], 'false');
  card.listeners.pointerdown(pointer());
  card.listeners.pointerup(pointer());
  assert.equal(card.attributes['aria-pressed'], 'true');
});
test('card drag ignores other pointers and ends on cancellation or lost capture without selecting', async () => {
  const { get } = await createBoard();
  const [caseCard, card] = get('cards').children, view = get('viewport');
  const left = parseFloat(card.style.left);
  card.listeners.pointerdown(pointer(1));
  card.listeners.pointermove(pointer(2, { clientX: 40 }));
  caseCard.listeners.pointerup(pointer(1));
  view.listeners.pointerdown(pointer(2));
  view.listeners.pointercancel(pointer(2));
  card.listeners.pointerup(pointer(2));
  assert.equal(parseFloat(card.style.left), left);
  card.listeners.pointermove(pointer(1, { clientX: 20 }));
  assert.equal(parseFloat(card.style.left), left + 20);
  card.listeners.pointercancel(pointer(1));
  card.listeners.pointermove(pointer(1, { clientX: 70 }));
  card.listeners.pointerup(pointer(1));
  assert.equal(parseFloat(card.style.left), left + 20);
  assert.equal(card.attributes['aria-pressed'], 'false');
  card.listeners.pointerdown(pointer(3));
  card.listeners.lostpointercapture(pointer(3));
  card.listeners.pointerup(pointer(3));
  assert.equal(card.attributes['aria-pressed'], 'false');
  card.listeners.pointerdown(pointer(4));
  card.listeners.pointerup(pointer(4));
  assert.equal(card.attributes['aria-pressed'], 'true');
});
test('background pan owns one pointer and recovers after lost capture or cancellation', async () => {
  const { get } = await createBoard();
  const view = get('viewport'), world = get('world');
  for (const end of ['lostpointercapture', 'pointercancel']) {
    const before = world.style.transform;
    view.listeners.pointerdown(pointer(1));
    view.listeners.pointermove(pointer(2, { clientX: 50 }));
    view.listeners.pointerup(pointer(2));
    view.listeners[end](pointer(2));
    assert.equal(world.style.transform, before);
    view.listeners.pointermove(pointer(1, { clientX: 25 }));
    const moved = world.style.transform;
    assert.notEqual(moved, before);
    view.listeners[end](pointer(1));
    view.listeners.pointermove(pointer(1, { clientX: 90 }));
    assert.equal(world.style.transform, moved);
  }
  const before = world.style.transform;
  view.listeners.pointerdown(pointer(5));
  view.listeners.pointermove(pointer(5, { clientX: 10 }));
  view.listeners.pointerup(pointer(5));
  assert.notEqual(world.style.transform, before);
});
test('case switches discard a stale active drag before rendering new cards', async () => {
  const { get } = await createBoard([{ id: '1', title: 'Published case' }, { id: '2', title: 'Second case' }]);
  const old = get('cards').children[1];
  old.listeners.pointerdown(pointer(1));
  get('cases').children[1].listeners.click();
  old.listeners.pointerup(pointer(1));
  assert.equal(get('details').children[0].textContent, 'Second case');
  const view = get('viewport'), world = get('world'), before = world.style.transform;
  view.listeners.pointerdown(pointer(2));
  view.listeners.pointermove(pointer(2, { clientX: 30 }));
  assert.notEqual(world.style.transform, before);
});


test('case identity stays aligned in the tab and named board group without following inspected citation titles', async () => {
  const title = 'Case <draft> & "notes"';
  const { get, document } = await createBoard([{ id: '1', title }, { id: '2', title: 'Second investigation' }]);
  assert.equal(document.title, title + ' · Evidence Board | Evidence Atlas');
  assert.equal(get('heading').textContent, title);
  assert.equal([...html.matchAll(/id="heading"/g)].length, 1);
  assert.match(html, /<h1 id="heading">/);
  const viewport = html.match(/<div class="viewport"[^>]+>/)[0];
  assert.match(viewport, /role="group"/); assert.match(viewport, /aria-labelledby="heading"/);
  assert.match(viewport, /aria-describedby="board-instructions"/);
  assert.doesNotMatch(viewport, /aria-label=/);
  get('cards').children[1].listeners.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(get('details').children[0].textContent, 'Original document');
  assert.equal(document.title, title + ' · Evidence Board | Evidence Atlas');
  get('cases').children[1].listeners.click();
  assert.equal(get('heading').textContent, 'Second investigation');
  assert.equal(document.title, 'Second investigation · Evidence Board | Evidence Atlas');
});

test('case search announces the display cap, whitespace-normalized matches and empty results without losing selection', async () => {
  assert.match(html, /id="search"[^>]*aria-describedby="case-search-help case-search-status" disabled/);
  assert.match(html, /id="case-search-status"[^>]*role="status" aria-atomic="true"/);
  const published = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), title: 'Case ' + (i + 1) }));
  const { get } = await createBoard(published, []);
  const status = get('case-search-status'), search = get('search'), list = get('cases');
  assert.equal(search.disabled, false);
  assert.equal(list.children.length, 18);
  assert.match(status.textContent, /18 of 25.*Refine your search/);
  const query = value => { search.value = value; search.listeners.input({ target: search }); };
  query('  cAsE 25  ');
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].textContent, 'Case 25');
  assert.match(status.textContent, /1 of 1 matching/);
  list.children[0].listeners.click();
  assert.equal(list.children[0].attributes['aria-pressed'], 'true');
  query('unmatched');
  assert.equal(list.children.length, 0);
  assert.match(status.textContent, /No published cases match.*Try another title/);
  assert.equal(get('heading').textContent, 'Case 25');
  query('   ');
  assert.equal(list.children.length, 18);
  assert.match(status.textContent, /18 of 25/);
  assert.ok(list.children.every(button => button.attributes['aria-pressed'] === 'false'));
  assert.equal(get('case-search-status'), status);
});
test('case search distinguishes a genuinely empty index from a failed public-record request', async () => {
  const empty = await createBoard([], []);
  assert.equal(empty.get('search').disabled, false);
  assert.equal(empty.get('case-search-status').textContent, 'No published cases available.');
  const failed = await createBoard([], [], true);
  assert.equal(failed.get('search').disabled, true);
  assert.match(failed.get('case-search-status').textContent, /unavailable.*could not be loaded/);
  assert.equal(failed.get('heading').textContent, 'Evidence service unavailable');
  assert.equal(failed.get('cards').children.length, 0);
});

test('zoom readout follows buttons and responsive Reset without repeat announcements during pan or at limits', async () => {
  assert.equal([...html.matchAll(/id="zoom-level"/g)].length, 1);
  assert.match(html, /<output id="zoom-level" aria-live="polite" aria-atomic="true">/);
  const { get } = await createBoard();
  const readout = get('zoom-level'), view = get('viewport');
  const status = get('status').textContent;
  assert.equal(readout.textContent, 'Zoom 100%');
  get('zin').listeners.click(); assert.equal(readout.textContent, 'Zoom 120%');
  get('zout').listeners.click(); assert.equal(readout.textContent, 'Zoom 100%');
  for (let i = 0; i < 12; i++) get('zin').listeners.click();
  assert.equal(readout.textContent, 'Zoom 200%');
  let value = readout.textContent, writes = 0;
  Object.defineProperty(readout, 'textContent', { get: () => value, set: next => { value = next; writes++; } });
  get('zin').listeners.click();
  view.listeners.pointerdown(pointer(42));
  view.listeners.pointermove(pointer(42, { clientX: 45, clientY: 15 }));
  view.listeners.pointerup(pointer(42));
  assert.equal(writes, 0, 'unchanged percentages must not retrigger the live region');
  assert.equal(get('status').textContent, status, 'zoom feedback does not replace citation/load status');
  view.clientWidth = 475;
  get('reset').listeners.click();
  assert.equal(readout.textContent, 'Zoom 50%'); assert.equal(writes, 1);
  get('reset').listeners.click(); assert.equal(writes, 1);
  for (let i = 0; i < 12; i++) get('zout').listeners.click();
  assert.equal(readout.textContent, 'Zoom 35%');
  const atMinimum = writes;
  get('zout').listeners.click(); assert.equal(writes, atMinimum);
  assert.equal(get('status').textContent, status);
});

test('saved layout: malformed or non-object storage leaves the published case and citations usable', async () => {
  for (const value of ['null', '[]', '42', '"old layout"', '{broken']) {
    const { get } = await createBoard(undefined, undefined, false, value);
    assert.equal(get('heading').textContent, 'Published case', value);
    assert.equal(get('cards').children.length, 2, value);
    assert.equal(get('search').disabled, false, value);
    assert.equal(get('cards').children[0].style.left, '500px', value);
    assert.match(get('citation-count').textContent, /1 of 1 unique indexed citation URLs/);
  }
});

test('saved layout: valid exact positions still restore and invalid entries use defaults', async () => {
  const url = 'https://records.example.org/archive?id=1';
  const key = 'source-' + encodeURIComponent(url);
  const valid = await createBoard(undefined, undefined, false, JSON.stringify({ case: { x: 100, y: 200 }, [key]: { x: 350, y: 120 } }));
  assert.equal(valid.get('cards').children[0].style.left, '100px');
  assert.equal(valid.get('cards').children[1].style.top, '120px');
  const invalid = await createBoard(undefined, undefined, false, JSON.stringify({ case: { x: 'bad', y: 20 }, [key]: null }));
  assert.equal(invalid.get('cards').children[0].style.left, '500px');
  assert.equal(invalid.get('cards').children[1].style.top, '75px');
});

test('Zoom minus never enlarges a mobile board fitted below the desktop minimum', async () => {
  const { get } = await createBoard();
  const view = get('viewport'), readout = get('zoom-level'), world = get('world');
  view.clientWidth = 285;
  get('reset').listeners.click();
  assert.equal(readout.textContent, 'Zoom 30%');
  const fitted = world.style.transform;
  get('zout').listeners.click();
  assert.equal(readout.textContent, 'Zoom 30%', 'zooming out from a fitted mobile scale must not enlarge it');
  assert.equal(world.style.transform, fitted);
  get('zin').listeners.click(); assert.equal(readout.textContent, 'Zoom 36%');
  get('zout').listeners.click(); assert.equal(readout.textContent, 'Zoom 30%');
  for (let i = 0; i < 12; i++) get('zout').listeners.click();
  assert.equal(readout.textContent, 'Zoom 30%');
  view.clientWidth = 1000;
  get('reset').listeners.click(); assert.equal(readout.textContent, 'Zoom 100%');
  for (let i = 0; i < 12; i++) get('zout').listeners.click();
  assert.equal(readout.textContent, 'Zoom 35%', 'desktop minimum remains unchanged after Reset');
});


test('first-focus skip link bypasses navigation and case choices to the existing focusable board toolbar', () => {
  const body = html.slice(html.indexOf('<body>') + '<body>'.length);
  assert.match(body, /^<a class="skip-board" href="#board-controls">Skip to evidence board<\/a><a class="skip-board" href="#case-files-heading">Skip to case search<\/a><a class="skip-board" href="#selected-record">Skip to selected record<\/a><header>/);
  assert.equal([...html.matchAll(/id="board-controls"/g)].length, 1);
  assert.match(html, /id="board-controls" tabindex="-1"/);
  assert.match(html, /#board-controls:focus-visible/);
  assert.match(html, /\.skip-board\{[^}]*max-width:calc\(100% - 32px\);min-height:44px/);
  assert.match(html, /\.skip-board\{[^}]*transform:translateY\(-200%\)/);
  assert.match(html, /\.skip-board:focus\{transform:none\}/);
});


test('card taps stay still at every zoom and real drags replace a stale saved status once per gesture', async () => {
  const { get, stored } = await createBoard();
  const card = get('cards').children[1], view = get('viewport'), status = get('status');
  for (const width of [285, 1000, 1900]) {
    view.clientWidth = width;
    get('reset').listeners.click();
    if (width === 1900) { for (let i=0;i<5;i++) get('zin').listeners.click(); }
    const scale = Number(get('zoom-level').textContent.match(/\d+/)[0])/100;
    get('save').listeners.click();
    const x = parseFloat(card.style.left), y = parseFloat(card.style.top);
    const wire = get('wires').children[0], saved = stored.get('atlas-evidence-board-layout-v2-1');
    card.listeners.pointerdown(pointer(11));
    card.listeners.pointermove(pointer(11,{clientX:3,clientY:3}));
    card.listeners.pointerup(pointer(11));
    assert.equal(parseFloat(card.style.left),x);
    assert.equal(parseFloat(card.style.top),y);
    assert.equal(get('wires').children[0],wire);
    assert.equal(card.attributes['aria-pressed'],'true');
    assert.match(status.textContent,/Layout saved/);
    let value=status.textContent,writes=0;
    Object.defineProperty(status,'textContent',{configurable:true,get:()=>value,set:next=>{value=next;writes++;}});
    card.listeners.pointerdown(pointer(12));
    card.listeners.pointermove(pointer(12,{clientX:5}));
    assert.ok(Math.abs(parseFloat(card.style.left)-(x+5/scale))<1e-8);
    assert.match(status.textContent,/unsaved changes/);
    card.listeners.pointermove(pointer(12,{clientX:10}));
    card.listeners.pointerup(pointer(12));
    assert.equal(writes,1);
    assert.equal(stored.get('atlas-evidence-board-layout-v2-1'),saved,'drag does not persist automatically');
    get('save').listeners.click();
    assert.match(status.textContent,/Layout saved/);
  }
});

test('clamped card drags do not announce a change until coordinates actually move', async () => {
  const { get } = await createBoard(undefined,undefined,false,JSON.stringify({case:{x:1000,y:660}}));
  const card=get('cards').children[0],status=get('status'),wire=get('wires').children[0];
  get('save').listeners.click();
  card.listeners.pointerdown(pointer(21));
  card.listeners.pointermove(pointer(21,{clientX:20,clientY:20}));
  assert.equal(card.style.left,'1000px'); assert.equal(card.style.top,'660px');
  assert.equal(get('wires').children[0],wire);
  assert.match(status.textContent,/Layout saved/);
  card.listeners.pointermove(pointer(21,{clientX:-10,clientY:-10}));
  assert.equal(card.style.left,'990px'); assert.equal(card.style.top,'650px');
  assert.match(status.textContent,/unsaved changes/);
  card.listeners.pointercancel(pointer(21));
  assert.match(status.textContent,/unsaved changes/);
});

test('keyboard destination outlines are available outside narrow-screen media queries', () => {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  const rule = css.match(/#board-controls:focus-visible,#selected-record:focus-visible,#details h2:focus-visible\{([^}]+)\}/);
  assert.ok(rule, 'all three programmatic keyboard destinations share a visible focus rule');
  let depth = 0;
  for (const ch of css.slice(0, rule.index)) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  assert.equal(depth, 0, 'desktop focus must not depend on a narrow-screen media query');
  assert.match(rule[1], /outline:2px solid var\(--mint\)/);
  assert.match(rule[1], /outline-offset:-2px/);
});

test('non-pointer click activates the card inspector without rehandling ordinary pointer clicks', async () => {
  const { get, document, getOpened } = await createBoard();
  const [caseCard, card] = get('cards').children;
  const initial = get('details').children[0];
  card.listeners.click({ detail: 1 });
  assert.equal(get('details').children[0], initial);
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    card.listeners.click({ detail: 0, [modifier]: true });
    assert.equal(get('details').children[0], initial);
  }
  card.listeners.pointerdown({ clientX: 0, clientY: 0, pointerId: 1, button: 0, isPrimary: true, stopPropagation() {} });
  card.listeners.click({ detail: 0 });
  assert.equal(get('details').children[0], initial, 'active pointer gesture must not be interrupted');
  card.listeners.pointercancel({ pointerId: 1 });
  card.listeners.click({ detail: 0 });
  const heading = get('details').children[0];
  assert.equal(heading.textContent, 'Original document');
  assert.equal(document.activeElement, heading);
  assert.equal(card.attributes['aria-pressed'], 'true');
  assert.equal(caseCard.attributes['aria-pressed'], 'false');
  card.listeners.click({ detail: 1 });
  assert.equal(get('details').children[0], heading, 'ordinary click must not rebuild the inspector');
  get('selected-record').listeners.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(document.activeElement, card);
  assert.equal(getOpened(), 0, 'activation must not open an external source');
});


test('copy citation preserves indexed provenance and full URL without opening a document', async () => {
  const writes = [];
  const record = { case_id: '1', title: 'Archive <scan>', publisher: 'Agency', publication_date: '1977-08-03',
    reference_code: 'ABC-1', source_id: 204, source_role: 'Annotated research reference', url: 'https://records.example.org/archive?id=1#page=4' };
  const { get, getOpened } = await createBoard(undefined, [record], false, undefined, { writeText: async text => writes.push(text) });
  assert.ok(!get('details').children.some(n => n.className === 'copy-citation'), 'case is not a citation');
  get('cards').children[1].listeners.keydown({ key: 'Enter', preventDefault() {} });
  const children = get('details').children, button = children.find(n => n.className === 'copy-citation');
  const feedback = children.find(n => n.attributes.role === 'status');
  assert.equal(button.type, 'button');
  assert.equal(feedback.attributes['aria-atomic'], 'true');
  assert.ok(children.some(n => n.textContent.includes('Atlas source record ID: 204') && n.textContent.includes('Indexed association (not a verified relationship): Annotated research reference')));
  await button.listeners.click();
  assert.deepEqual(writes, [
    ['Indexed source citation — not independently verified', 'Title: Archive <scan>', 'Publisher: Agency',
      'Publication date: 1977-08-03', 'Reference: ABC-1', 'Atlas source record ID: 204',
      'Indexed association (not a verified relationship): Annotated research reference', 'Indexed URL: ' + record.url].join('\n')
  ]);
  assert.match(feedback.textContent, /copied/);
  assert.equal(getOpened(), 0);
});

test('copy citation reports unavailable or denied clipboard access without claiming success', async () => {
  for (const clipboard of [undefined, { writeText: async () => { throw Error('denied'); } }]) {
    const { get } = await createBoard(undefined, undefined, false, undefined, clipboard);
    get('cards').children[1].listeners.keydown({ key: 'Enter', preventDefault() {} });
    const children = get('details').children;
    await children.find(n => n.className === 'copy-citation').listeners.click();
    assert.match(children.find(n => n.attributes.role === 'status').textContent, /Could not copy citation/);
  }
});

test('pending citation copy cannot replace newly selected record feedback or run twice', async () => {
  let complete, writes = 0;
  const { get } = await createBoard(undefined, undefined, false, undefined, {
    writeText: () => { writes++; return new Promise(resolve => { complete = resolve; }); }
  });
  get('cards').children[1].listeners.keydown({ key: 'Enter', preventDefault() {} });
  const button = get('details').children.find(n => n.className === 'copy-citation');
  const pending = button.listeners.click();
  await button.listeners.click();
  assert.equal(writes, 1);
  get('cards').children[0].listeners.keydown({ key: 'Enter', preventDefault() {} });
  complete(); await pending;
  assert.equal(get('details').children[0].textContent, 'Published case');
  assert.ok(!get('details').children.some(n => n.className === 'copy-citation' || n.attributes.role === 'status'));
});


test('Clear search restores cases and input focus without changing the inspected investigation', async () => {
  assert.match(html, /<button id="clear-cases" type="button" disabled>Clear search<\/button>/);
  const { get, document } = await createBoard([{ id: '1', title: 'Published case' }, { id: '2', title: 'Second investigation' }]);
  const clear = get('clear-cases'), input = get('search');
  assert.equal(clear.disabled, true);
  get('cases').children[1].listeners.click();
  const cards = get('cards').children, heading = get('heading').textContent;
  input.value = 'no match'; input.listeners.input({ target: input });
  assert.equal(clear.disabled, false); assert.equal(get('cases').children.length, 0);
  clear.focus(); clear.listeners.click();
  assert.equal(input.value, ''); assert.equal(document.activeElement, input);
  assert.equal(clear.disabled, true); assert.equal(get('cases').children.length, 2);
  assert.equal(get('cases').children[1].attributes['aria-pressed'], 'true');
  assert.equal(get('cards').children, cards, 'clearing a filter must not rebuild the active board');
  assert.equal(get('heading').textContent, heading);
  assert.match(get('case-search-status').textContent, /2 of 2/);
  input.value = '   '; input.listeners.input({ target: input });
  assert.equal(clear.disabled, false, 'raw whitespace can still be cleared');
  clear.listeners.click(); assert.equal(input.value, '');
});

test('Clear search does not turn a failed case load into an empty result', async () => {
  const { get, document } = await createBoard(undefined, undefined, true);
  const status = get('case-search-status').textContent;
  const heading = get('heading').textContent;
  get('clear-cases').listeners.click();
  assert.equal(get('case-search-status').textContent, status);
  assert.equal(get('heading').textContent, heading);
  assert.equal(document.activeElement, undefined);
});


test('short landscape board overrides the tall canvas without affecting portrait', () => {
  const css = html.split('<style>')[1].split('</style>')[0];
  const rule = '@media(max-width:1050px) and (max-height:600px) and (orientation:landscape){.viewport{height:70vh;height:70dvh;min-height:260px}}';
  assert.equal(css.split(rule).length, 2);
  assert.ok(css.includes('.viewport{height:min(73vh,760px);min-height:480px;'));
  assert.ok(css.includes('@media(max-width:650px){.shell{display:block}'));
  assert.ok(css.indexOf(rule) > css.indexOf('.viewport{height:540px}'));
  assert.ok(css.includes('.viewport{height:540px}'));
});


test('phone users can jump past the case list and return to a focusable search heading', () => {
  const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.equal((html.match(/id="case-files-heading"/g) || []).length, 1);
  assert.match(html, /<h2 id="case-files-heading" tabindex="-1">Case files<\/h2>/);
  assert.ok(html.indexOf('id="case-files-heading"') < html.indexOf('id="search"'));
  assert.match(html, /id="board-controls" tabindex="-1"/);
  assert.ok(html.indexOf('href="#board-controls">Board controls') < html.indexOf('id="cases"'));
  assert.match(html, /id="save"[^>]*>Save layout<\/button><a class="board-jump case-search-jump" href="#case-files-heading">Search case files/);
  assert.match(css, /#case-files-heading:focus-visible\{outline:2px solid var\(--mint\)/);
  assert.match(css, /\.board-jump\.case-search-jump\{display:none\}\s*@media\(max-width:650px\)\{\.board-jump\.case-search-jump\{display:inline-flex\}\}/);
  assert.match(css, /\.board-jump\{display:inline-flex;align-items:center;min-height:44px/);
});


test('Save layout becomes available only with a rendered case and stays unavailable for empty or failed loads', async () => {
  assert.match(html, /<button id="save" disabled>Save layout<\/button>/);
  const loaded = await createBoard();
  assert.equal(loaded.get('save').disabled, false);
  loaded.get('save').listeners.click();
  assert.ok(loaded.stored.has('atlas-evidence-board-layout-v2-1'));
  assert.match(loaded.get('status').textContent, /Layout saved/);
  for (const page of [await createBoard([], []), await createBoard(undefined, undefined, true)]) {
    assert.equal(page.get('save').disabled, true);
    const status = page.get('status').textContent;
    page.get('save').listeners.click(); // Guard also protects non-native/programmatic activation.
    assert.equal(page.stored.size, 0);
    assert.equal(page.get('status').textContent, status);
  }
});


test('keyboard panning uses the focused viewport, preserves card positions, and resets normally', async () => {
  assert.match(html, /id="viewport"[^>]*tabindex="0"/);
  assert.match(html, /#viewport:focus-visible\{outline:3px solid var\(--mint\)/);
  assert.match(html, /use arrow keys to pan \(Shift for larger steps\)/);
  const { get, stored, document, getOpened } = await createBoard();
  const viewport = get('viewport'), world = get('world'), cards = get('cards').children;
  const inspector = get('details').children[0], initial = world.style.transform;
  const positions = cards.map(card => [card.style.left, card.style.top]);
  viewport.focus();
  let prevented = 0;
  const key = (name, extra = {}) => viewport.listeners.keydown({
    key: name, target: viewport, preventDefault() { prevented++; }, ...extra
  });
  key('ArrowRight');
  assert.equal(world.style.transform, 'translate(40px,15px) scale(1)');
  key('ArrowDown', { shiftKey: true });
  assert.equal(world.style.transform, 'translate(40px,115px) scale(1)');
  key('ArrowLeft'); key('ArrowUp', { shiftKey: true });
  assert.equal(world.style.transform, initial);
  assert.equal(prevented, 4);
  key('Tab'); key('Escape'); key('ArrowLeft', { ctrlKey: true });
  key('ArrowRight', { altKey: true }); key('ArrowUp', { metaKey: true });
  key('ArrowDown', { target: cards[1] });
  cards[1].focus(); key('ArrowDown');
  assert.equal(prevented, 4, 'other targets and shortcuts retain native behavior');
  assert.equal(document.activeElement, cards[1]);
  assert.equal(world.style.transform, initial);
  viewport.focus();
  viewport.listeners.pointerdown(pointer(1));
  key('ArrowRight');
  assert.equal(prevented, 4, 'do not pan during an active pointer gesture');
  viewport.listeners.pointercancel({ pointerId: 1 });
  key('ArrowLeft');
  assert.equal(world.style.transform, 'translate(-40px,15px) scale(1)');
  get('reset').listeners.click();
  assert.equal(world.style.transform, initial);
  assert.deepEqual(cards.map(card => [card.style.left, card.style.top]), positions);
  assert.equal(get('details').children[0], inspector);
  assert.equal(stored.size, 0);
  assert.equal(getOpened(), 0);
});

test('keyboard panning does not intercept navigation before a case is available', async () => {
  for (const page of [await createBoard([], []), await createBoard(undefined, undefined, true)]) {
    const viewport = page.get('viewport');
    viewport.focus();
    const original = page.get('world').style.transform;
    viewport.listeners.keydown({ key: 'ArrowRight', target: viewport,
      preventDefault() { assert.fail('empty board must not intercept navigation'); } });
    assert.equal(page.get('world').style.transform, original);
  }
});


test('Reset view is labeled by scope and preserves moved cards and their saved layout', async () => {
  assert.match(html, /<button id="reset">Reset view<\/button>/);
  assert.match(html, /Reset view fits the board without changing card positions\./);
  const { get, stored } = await createBoard();
  const tile = get('cards').children[1];
  tile.listeners.keydown({ key: 'Enter', preventDefault() {} });
  get('details').children.find(n => n.className === 'move-controls').children[2].listeners.click();
  const position = { left: tile.style.left, top: tile.style.top };
  get('save').listeners.click();
  const saved = stored.get('atlas-evidence-board-layout-v2-1');
  get('zin').listeners.click();
  assert.equal(get('zoom-level').textContent, 'Zoom 120%');
  get('reset').listeners.click();
  assert.equal(get('zoom-level').textContent, 'Zoom 100%');
  assert.deepEqual({ left: tile.style.left, top: tile.style.top }, position);
  assert.equal(stored.get('atlas-evidence-board-layout-v2-1'), saved);
  assert.equal(tile.attributes['aria-pressed'], 'true');
});


test('source inspector shows the full validated indexed URL before copying or opening it', async () => {
  const record = { case_id: '1', title: 'Archival reference', url: 'https://records.example.org:8443/archive?id=a%26b#page=4' };
  const second = { case_id: '1', title: 'Another reference', url: 'https://records.example.org/other#page=2' };
  const unsafe = { case_id: '1', title: 'Unsafe', url: 'https://user:pass@records.example.org/hidden' };
  const { get, getOpened } = await createBoard(undefined, [record, second, unsafe]);
  const cards = get('cards').children, details = get('details');
  const urls = () => details.children.filter(n => n.className === 'muted indexed-url');
  assert.equal(cards.length, 3, 'credential-bearing citation remains excluded');
  assert.equal(urls().length, 0, 'case inspector does not show a source destination');
  for (const [index, item] of [[1, record], [2, second]]) {
    cards[index].listeners.keydown({ key: 'Enter', preventDefault() {} });
    assert.equal(urls().length, 1);
    assert.equal(urls()[0].tag, 'p', 'destination is selectable text, not another link');
    assert.equal(urls()[0].textContent, 'Indexed URL: ' + item.url);
    assert.equal(details.children.find(n => n.tag === 'a').href, item.url);
    assert.match(details.children.find(n => n.className === 'badge').textContent, /not independently verified/);
  }
  cards[0].listeners.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(urls().length, 0, 'switching back clears the previous destination');
  assert.equal(getOpened(), 0, 'preview never opens a source automatically');
});


test('window blur cancels card and background gestures, releases capture and permits fresh navigation', async () => {
  const { get, document, windowListeners } = await createBoard();
  assert.equal(typeof windowListeners.blur, 'function');
  const card = get('cards').children[1], view = get('viewport'), world = get('world');
  const left = card.style.left;
  card.listeners.pointerdown(pointer(81));
  assert.equal(card.hasPointerCapture(81), true);
  windowListeners.blur();
  assert.equal(card.hasPointerCapture(81), false);
  card.listeners.pointermove(pointer(81, { clientX: 80 }));
  card.listeners.pointerup(pointer(81));
  assert.equal(card.style.left, left);
  assert.equal(card.attributes['aria-pressed'], 'false', 'late release must not inspect a cancelled card');
  view.listeners.pointerdown(pointer(82));
  const transform = world.style.transform;
  windowListeners.blur();
  assert.equal(view.hasPointerCapture(82), false);
  view.listeners.pointermove(pointer(82, { clientX: 80 }));
  view.listeners.pointerup(pointer(82));
  assert.equal(world.style.transform, transform);
  view.focus();
  let prevented = 0;
  view.listeners.keydown({ key: 'ArrowRight', target: view, preventDefault() { prevented++; } });
  assert.equal(prevented, 1, 'stale drag state must not block keyboard panning');
  assert.notEqual(world.style.transform, transform);
  card.listeners.pointerdown(pointer(83)); card.listeners.pointerup(pointer(83));
  assert.equal(card.attributes['aria-pressed'], 'true', 'a fresh gesture works after cancellation');
  const focused = document.activeElement;
  windowListeners.blur();
  assert.equal(document.activeElement, focused, 'idle blur cleanup does not move page focus');
});


test('empty published index replaces loading heading without fabricating cards or enabling save', async () => {
  const { get, stored } = await createBoard([], []);
  assert.equal(get('heading').textContent, 'No published cases available');
  assert.match(get('status').textContent, /No sample evidence has been substituted/);
  assert.equal(get('cards').children.length, 0);
  assert.equal(get('wires').children.length, 0);
  assert.equal(get('save').disabled, true);
  assert.equal(stored.size, 0);
});

test('case-only inspector explains that an indexed-citation gap is not corroboration or proof of absence', async () => {
  const published = [{ id: '1', title: 'Case without citations' }, { id: '2', title: 'Case with citation' }];
  const references = [{ case_id: '2', title: 'Archive record', url: 'https://records.example.org/archive?id=2' }];
  const { get, getOpened } = await createBoard(published, references);
  const notice = () => get('details').children.find(n => n.className === 'smallnote empty-citations');
  assert.equal(notice(), undefined, 'the initially selected case has a citation');
  get('cases').children[0].listeners.click();
  assert.equal(get('cards').children.length, 1);
  assert.equal(get('wires').children.length, 0);
  assert.match(notice().textContent, /case card alone is not corroborating evidence/);
  assert.match(notice().textContent, /does not establish that no evidence exists/);
  get('cases').children[1].listeners.click();
  assert.equal(notice(), undefined, 'the prior case notice must not persist');
  assert.equal(get('cards').children.length, 2);
  assert.equal(getOpened(), 0);
});


test('keyboard-focused cards pan into view without moving cards, changing selection or opening sources', async () => {
  const { get, stored, getOpened } = await createBoard();
  const view = get('viewport'), world = get('world'), card = get('cards').children[1];
  view.clientLeft = view.clientTop = 0; view.clientHeight = 480;
  view.getBoundingClientRect = () => ({ left: 10, top: 20 });
  let keyboard = false, bounds = { left: 1050, top: 430, right: 1224, bottom: 604, width: 174, height: 174 };
  card.matches = selector => selector === ':focus-visible' && keyboard;
  card.getBoundingClientRect = () => bounds;
  const position = { ...card.style }, initial = world.style.transform;
  card.listeners.focus();
  assert.equal(world.style.transform, initial, 'pointer focus does not pan');
  keyboard = true;
  card.listeners.focus();
  assert.equal(world.style.transform, 'translate(-222px,-97px) scale(1)');
  bounds = { left: 828, top: 318, right: 1002, bottom: 492, width: 174, height: 174 };
  card.listeners.focus();
  assert.equal(world.style.transform, 'translate(-222px,-97px) scale(1)', 'already visible card does not pan again');
  bounds = { left: -100, top: -30, right: 1100, bottom: 570, width: 1200, height: 600 };
  card.listeners.focus();
  assert.equal(world.style.transform, 'translate(-104px,-39px) scale(1)', 'oversized card aligns to leading edges');
  assert.deepEqual(card.style, position);
  assert.equal(card.attributes['aria-pressed'], 'false');
  assert.equal(stored.size, 0);
  assert.equal(getOpened(), 0);
  assert.match(html, /overflow:hidden;overflow:clip;position:relative/, 'prevent native focus scrolling from fighting board panning');
});

test('retry recovers a failed board load without overlapping requests and restores search focus', async () => {
  let requests = 0, available = false, release;
  const gate = new Promise(resolve => { release = resolve; });
  const request = async url => {
    requests++;
    if (!available) return { ok: false };
    await gate;
    return { ok: true, json: async () => url.includes('paper-trails-data')
      ? { references: [] } : [{ id: '1', title: 'Recovered record' }] };
  };
  const { get, document, stored } = await createBoard(undefined, undefined, false, undefined, undefined, request);
  const retry = get('retry-records');
  assert.equal(retry.hidden, false);
  assert.equal(get('search').disabled, true);
  get('search').value = 'Recovered';
  retry.focus(); available = true;
  const pending = retry.listeners.click();
  retry.listeners.click();
  assert.equal(requests, 4, 'one initial pair and one retry pair only');
  assert.equal(retry.attributes['aria-disabled'], 'true');
  release(); await pending;
  assert.equal(retry.hidden, true);
  assert.equal(get('search').disabled, false);
  assert.equal(get('search').value, 'Recovered');
  assert.equal(get('heading').textContent, 'Recovered record');
  assert.equal(document.activeElement, get('search'));
  assert.equal(stored.size, 0);
});

test('retry keeps a repeated failure actionable and never relabels it as empty evidence', async () => {
  const { get, document } = await createBoard(undefined, undefined, true);
  const retry = get('retry-records'); retry.focus();
  await retry.listeners.click();
  assert.equal(retry.hidden, false);
  assert.equal(retry.attributes['aria-disabled'], 'false');
  assert.equal(retry.textContent, 'Retry loading records');
  assert.equal(document.activeElement, retry);
  assert.equal(get('save').disabled, true);
  assert.equal(get('cards').children.length, 0);
  assert.match(get('case-search-status').textContent, /unavailable/);
  assert.match(get('status').textContent, /Could not load/);
});

test('empty retry results remain honest and successful retry does not steal unrelated focus', async () => {
  let available = false;
  const request = async url => ({ ok: available, json: async () => url.includes('paper-trails-data') ? { references: [] } : [] });
  const { get, document } = await createBoard(undefined, undefined, false, undefined, undefined, request);
  get('viewport').focus(); available = true;
  await get('retry-records').listeners.click();
  assert.equal(document.activeElement, get('viewport'));
  assert.equal(get('retry-records').hidden, true);
  assert.equal(get('heading').textContent, 'No published cases available');
  assert.equal(get('save').disabled, true);
  assert.equal(get('cards').children.length, 0);
});

for (const stage of ['request', 'response body']) {
  test(`stalled ${stage} reaches a retryable deadline and late results cannot replace recovery`, async () => {
    let expire, cleared = 0, healthy = false, finish;
    const signals = [];
    const pending = new Promise(resolve => { finish = resolve; });
    const clock = { setTimeout(fn) { expire = fn; return 7; }, clearTimeout() { cleared++; } };
    const payload = url => url.includes('paper-trails-data') ? { references: [] }
      : [{ id: '1', title: healthy ? 'Recovered investigation' : 'Expired investigation' }];
    const request = async (url, options) => {
      signals.push(options?.signal);
      if (healthy) return { ok: true, json: async () => payload(url) };
      if (stage === 'request') await pending;
      return { ok: true, json: async () => { if (!healthy && stage === 'response body') await pending; return payload(url); } };
    };
    const { get, stored } = await createBoard(undefined, undefined, false, undefined, undefined, request, clock);
    assert.equal(typeof expire, 'function');
    expire(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(get('retry-records').hidden, false);
    assert.equal(get('retry-records').attributes['aria-disabled'], 'false');
    assert.match(get('status').textContent, /timed out/i);
    assert.equal(get('save').disabled, true);
    assert.equal(get('cards').children.length, 0);
    assert.ok(signals.every(signal => signal?.aborted));
    healthy = true;
    await get('retry-records').listeners.click();
    assert.equal(get('heading').textContent, 'Recovered investigation');
    const card = get('cards').children[0], status = get('status').textContent;
    healthy = false; finish(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(get('heading').textContent, 'Recovered investigation');
    assert.equal(get('cards').children[0], card);
    assert.equal(get('status').textContent, status);
    assert.equal(stored.size, 0);
    assert.equal(cleared, 2, 'both attempts clear their deadlines');
  });
}

test('settled record requests clean up their deadline on success and failure', async () => {
  for (const failed of [false, true]) {
    let cleared = 0;
    const clock = { setTimeout() { return 9; }, clearTimeout(id) { assert.equal(id, 9); cleared++; } };
    await createBoard(undefined, undefined, failed, undefined, undefined, undefined, clock);
    assert.equal(cleared, 1);
  }
});

test('published case deep links open the requested investigation and preserve focus', async () => {
  const records = [{ id: '1', title: 'Default case' }, { id: '2/3', title: 'Linked case' }];
  const f = await createBoard(records, undefined, false, undefined, undefined, undefined, undefined, { hash: '#case=2%2F3' });
  assert.equal(f.get('heading').textContent, 'Linked case');
  assert.equal(f.get('cases').children[1].attributes['aria-pressed'], 'true');
  assert.equal(f.get('case-link-status').textContent, '');
  assert.equal(f.document.activeElement, undefined);
  assert.deepEqual(f.historyCalls, []);
});

test('case selection creates shareable history; hash traversal preserves non-case navigation', async () => {
  const f = await createBoard([{ id: '1', title: 'Default case' }, { id: '2', title: 'Second case' }]);
  assert.deepEqual(f.historyCalls, [{ method: 'replaceState', hash: '#case=1' }]);
  const second = f.get('cases').children[1]; second.focus(); second.listeners.click();
  assert.equal(f.get('heading').textContent, 'Second case');
  assert.equal(f.location.hash, '#case=2');
  assert.equal(f.historyCalls[1].method, 'pushState');
  assert.equal(f.document.activeElement, second);
  const card = f.get('cards').children[0];
  f.location.hash = '#board-controls'; f.windowListeners.hashchange();
  assert.equal(f.get('cards').children[0], card);
  f.location.hash = '#case=1'; f.windowListeners.hashchange();
  assert.equal(f.get('heading').textContent, 'Default case');
  assert.equal(f.historyCalls.length, 2, 'history traversal must not push another entry');
  assert.equal(f.stored.size, 0);
});

test('unavailable and malformed case links explicitly identify the fallback without rewriting history', async () => {
  for (const hash of ['#case=999', '#case=%ZZ']) {
    const f = await createBoard(undefined, undefined, false, undefined, undefined, undefined, undefined, { hash });
    assert.equal(f.get('heading').textContent, 'Published case');
    assert.match(f.get('case-link-status').textContent, /unavailable.*Showing Published case instead/);
    assert.equal(f.location.hash, hash);
    assert.deepEqual(f.historyCalls, []);
    f.get('cases').children[0].listeners.click();
    assert.equal(f.get('case-link-status').textContent, '');
    assert.equal(f.location.hash, '#case=1');
  }
});

test('reselecting the active published case preserves unsaved layout, zoom and selected source', async () => {
  const { get, stored, document, location, historyCalls } = await createBoard([
    { id: '1', title: 'Published case' }, { id: '2', title: 'Other case' }
  ]);
  const card = get('cards').children[1];
  card.listeners.keydown({ key: 'Enter', preventDefault() {} });
  const controls = get('details').children.find(n => n.className === 'move-controls');
  controls.children[2].listeners.click();
  get('zin').listeners.click();
  const position = { ...card.style }, transform = get('world').style.transform;
  const status = get('status').textContent, heading = get('details').children[0];
  const current = get('cases').children[0];
  current.focus(); current.listeners.click();
  assert.equal(get('cards').children[1], card, 'reselection must not rebuild the board');
  assert.deepEqual(card.style, position);
  assert.equal(get('world').style.transform, transform);
  assert.equal(get('details').children[0], heading);
  assert.equal(card.attributes['aria-pressed'], 'true');
  assert.equal(get('status').textContent, status);
  assert.equal(document.activeElement, current);
  assert.equal(location.hash, '#case=1');
  assert.equal(historyCalls.length, 1, 'no redundant history entry');
  assert.equal(stored.size, 0, 'no implicit layout save');
  get('cases').children[1].listeners.click();
  assert.equal(get('heading').textContent, 'Other case');
  assert.equal(location.hash, '#case=2');
});

test('Escape cancels a card drag, restores its position and wires, and ignores a late release', async () => {
  const { get, stored, windowListeners, getOpened } = await createBoard();
  const card = get('cards').children[1], world = get('world');
  const position = { ...card.style }, transform = world.style.transform;
  const wires = () => get('wires').children.map(n => n.attributes.d);
  const originalWires = wires();
  card.listeners.pointerdown(pointer(91));
  card.listeners.pointermove(pointer(91, { clientX: 90, clientY: 75 }));
  assert.notDeepEqual(card.style, position);
  let prevented = 0;
  windowListeners.keydown({ key: 'Escape', preventDefault() { prevented++; } });
  assert.equal(prevented, 1);
  assert.deepEqual(card.style, position);
  assert.deepEqual(wires(), originalWires);
  assert.equal(world.style.transform, transform);
  assert.equal(card.hasPointerCapture(91), false);
  assert.equal(card.attributes['aria-pressed'], 'false');
  card.listeners.pointermove(pointer(91, { clientX: 120 }));
  card.listeners.pointerup(pointer(91));
  assert.deepEqual(card.style, position);
  assert.equal(card.attributes['aria-pressed'], 'false');
  assert.match(get('status').textContent, /Card drag cancelled/);
  assert.equal(stored.size, 0);
  assert.equal(getOpened(), 0);
});

test('Escape cancels background panning without changing card coordinates, zoom or focus', async () => {
  const { get, document, windowListeners, stored } = await createBoard();
  const view = get('viewport'), world = get('world'), card = get('cards').children[0];
  get('zin').listeners.click();
  const transform = world.style.transform, position = { ...card.style }, zoom = get('zoom-level').textContent;
  get('search').focus();
  view.listeners.pointerdown(pointer(92));
  view.listeners.pointermove(pointer(92, { clientX: 95, clientY: 95 }));
  assert.notEqual(world.style.transform, transform);
  windowListeners.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(world.style.transform, transform);
  assert.equal(view.hasPointerCapture(92), false);
  assert.deepEqual(card.style, position);
  assert.equal(get('zoom-level').textContent, zoom);
  assert.equal(document.activeElement, get('search'));
  assert.equal(stored.size, 0);
  assert.match(get('status').textContent, /Board pan cancelled/);
});

test('gesture Escape cancellation leaves idle Escape, ordinary keys and modified shortcuts untouched', async () => {
  const { get, windowListeners } = await createBoard();
  let prevented = 0;
  const event = extra => ({ key: 'Escape', preventDefault() { prevented++; }, ...extra });
  windowListeners.keydown(event());
  assert.equal(prevented, 0);
  const card = get('cards').children[1], position = { ...card.style };
  card.listeners.pointerdown(pointer(93));
  for (const extra of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { key: 'ArrowRight' }]) {
    windowListeners.keydown(event(extra));
    assert.equal(card.hasPointerCapture(93), true);
  }
  assert.equal(prevented, 0);
  card.listeners.pointermove(pointer(93, { clientX: 80 }));
  assert.notDeepEqual(card.style, position, 'guarded keys did not cancel the gesture');
  windowListeners.keydown(event());
  assert.deepEqual(card.style, position);
  assert.equal(prevented, 1);
});

test('board status identifies the investigation on deep links, case selection and history without moving focus', async () => {
  const cases = [{ id: '1', title: 'First investigation' }, { id: '2', title: 'Second <investigation>' }];
  const references = cases.map(c => ({ case_id: c.id, title: 'Citation', url: 'https://records.example.org/' + c.id }));
  const { get, document, location, windowListeners } = await createBoard(cases, references, false, undefined, undefined, undefined, undefined, { hash: '#case=2' });
  const status = get('status');
  assert.ok(status.textContent.startsWith('Opened investigation: Second <investigation>. '));
  assert.ok(status.textContent.includes(get('citation-count').textContent));
  get('search').focus();
  get('cases').children[0].listeners.click();
  assert.ok(status.textContent.startsWith('Opened investigation: First investigation. '));
  assert.equal(document.activeElement, get('search'));
  location.hash = '#case=2'; windowListeners.hashchange();
  assert.ok(status.textContent.startsWith('Opened investigation: Second <investigation>. '));
  assert.equal(document.activeElement, get('search'));
  const message = status.textContent;
  get('cards').children[1].listeners.pointerdown(pointer(94));
  get('cards').children[1].listeners.pointerup(pointer(94));
  assert.equal(status.textContent, message, 'source inspection does not announce another investigation');
});

test('case announcement retains the citation-gap qualification for an investigation without indexed URLs', async () => {
  const { get } = await createBoard([{ id: '1', title: 'Case without indexed URLs' }], []);
  assert.ok(get('status').textContent.startsWith('Opened investigation: Case without indexed URLs. '));
  assert.match(get('status').textContent, /does not establish that no evidence exists/);
});

test('malformed published case rows do not block valid investigations or disappear from the search warning', async () => {
  const rows = [null, { id: 'bad', title: 42 }, { id: 'blank', title: '  ' },
    { id: {}, title: 'Invalid identity' }, { id: 2, title: 'Valid investigation' }];
  const { get, location } = await createBoard(rows, []);
  assert.equal(get('heading').textContent, 'Valid investigation');
  assert.equal(get('cases').children.length, 1);
  assert.equal(get('search').disabled, false);
  assert.equal(location.hash, '#case=2');
  assert.match(get('case-search-status').textContent, /4 malformed case records were omitted/);
  get('search').value = 'not found';
  get('search').listeners.input({ target: get('search') });
  assert.match(get('case-search-status').textContent, /No published cases match/);
  assert.match(get('case-search-status').textContent, /4 malformed case records were omitted/);
  get('clear-cases').listeners.click();
  assert.equal(get('cases').children.length, 1);
  assert.match(get('case-search-status').textContent, /4 malformed case records were omitted/);
});

test('an entirely malformed nonempty case index is an error, not an empty published collection, and can recover', async () => {
  let recovered = false;
  const request = async url => ({ ok: true, json: async () => url.includes('paper-trails-data')
    ? { references: [] } : recovered ? [{ id: '7', title: 'Recovered investigation' }] : [{ id: '7', title: {} }] });
  const { get } = await createBoard(undefined, undefined, false, undefined, undefined, request);
  assert.equal(get('heading').textContent, 'Evidence service unavailable');
  assert.match(get('status').textContent, /No usable case records in the returned index/);
  assert.equal(get('search').disabled, true);
  assert.equal(get('save').disabled, true);
  assert.equal(get('retry-records').hidden, false);
  recovered = true;
  await get('retry-records').listeners.click();
  assert.equal(get('heading').textContent, 'Recovered investigation');
  assert.equal(get('search').disabled, false);
  assert.equal(get('retry-records').hidden, true);
  assert.equal(get('case-search-status').textContent, '1 of 1 matching published cases shown.');
});

test('a genuinely empty case index still reports an empty collection', async () => {
  const { get } = await createBoard([], []);
  assert.equal(get('heading').textContent, 'No published cases available');
  assert.equal(get('case-search-status').textContent, 'No published cases available.');
  assert.equal(get('search').disabled, false);
  assert.equal(get('retry-records').hidden, true);
  assert.equal(get('save').disabled, true);
});

test('zoom retains the board point under the viewport center after panning and at both limits', async () => {
  for (const [width, height] of [[320,540], [780,300], [1280,760]]) {
    const { get, stored, document } = await createBoard();
    const view = get('viewport'), world = get('world');
    view.clientWidth = width; view.clientHeight = height;
    get('reset').listeners.click();
    view.focus();
    view.listeners.keydown({ key: 'ArrowRight', target: view, preventDefault() {} });
    view.listeners.keydown({ key: 'ArrowUp', target: view, shiftKey: true, preventDefault() {} });
    const transform = () => {
      const match = world.style.transform.match(/^translate\(([-\d.e+]+)px,([-\d.e+]+)px\) scale\(([-\d.e+]+)\)$/);
      assert.ok(match, 'valid finite transform');
      return match.slice(1).map(Number);
    };
    const center = () => {
      const [x,y,z] = transform();
      return [(width/2-x)/z, (height/2-y)/z];
    };
    const point = center(), card = get('cards').children[1], position = { ...card.style };
    const inspector = get('details').children[0], initialZoom = transform()[2];
    for (const button of ['zin','zin','zout',...Array(20).fill('zin'),...Array(20).fill('zout')]) {
      const previous = world.style.transform, scale = transform()[2];
      get(button).listeners.click();
      const current = center();
      assert.ok(Math.abs(current[0]-point[0]) < 1e-8);
      assert.ok(Math.abs(current[1]-point[1]) < 1e-8);
      if (scale === transform()[2]) assert.equal(world.style.transform, previous);
    }
    assert.equal(transform()[2], Math.min(.35,initialZoom));
    assert.deepEqual(card.style, position);
    assert.equal(get('details').children[0], inspector);
    assert.equal(document.activeElement, view);
    assert.equal(stored.size, 0);
    get('reset').listeners.click();
    assert.equal(transform()[2], initialZoom);
    assert.equal(transform()[1], 15);
  }
});

test('zoom-out adapts to a narrower pane without Reset and never enlarges after widening', async () => {
  const { get, stored, document } = await createBoard();
  const view = get('viewport'), world = get('world'), card = get('cards').children[1];
  view.clientHeight = 480;
  const scale = () => Number(world.style.transform.match(/scale\(([^)]+)\)/)[1]);
  for (let i = 0; i < 20; i++) get('zout').listeners.click();
  assert.equal(scale(), .35);
  const position = { ...card.style }, inspector = get('details').children[0], status = get('status').textContent;
  get('search').focus();
  const previous = world.style.transform;
  view.clientWidth = 285;
  assert.equal(world.style.transform, previous, 'resizing alone must not reset or pan the view');
  get('zout').listeners.click();
  assert.equal(scale(), .3, 'zoom-out reaches the current fitted width without Reset');
  assert.equal(get('zoom-level').textContent, 'Zoom 30%');
  view.clientWidth = 1000;
  const narrow = world.style.transform;
  get('zout').listeners.click();
  assert.equal(world.style.transform, narrow, 'zoom-out after widening must never enlarge the board');
  get('zin').listeners.click();
  assert.equal(scale(), .36);
  get('zout').listeners.click();
  assert.equal(scale(), .3);
  assert.deepEqual(card.style, position);
  assert.equal(get('details').children[0], inspector);
  assert.equal(get('status').textContent, status);
  assert.equal(document.activeElement, get('search'));
  assert.equal(stored.size, 0);
  get('reset').listeners.click();
  for (let i = 0; i < 20; i++) get('zout').listeners.click();
  assert.equal(scale(), .35, 'explicit Reset restores the wide-pane minimum');
});


test('disabled JavaScript explains unavailable live citations and hides unusable board controls', () => {
  const head = html.match(/<head>[\s\S]*?<\/head>/)[0];
  const body = html.match(/<body>[\s\S]*?<\/body>/)[0];
  assert.match(head, /<noscript><style>\.shell,\.skip-board\{display:none\}<\/style><\/noscript>/);
  const fallback = body.match(/<noscript>([\s\S]*?)<\/noscript>/);
  assert.ok(fallback, 'body has a non-script fallback');
  assert.match(fallback[1], /<h1>Evidence Board requires JavaScript<\/h1>/);
  assert.match(fallback[1], /indexed citation cards cannot load while JavaScript is disabled/);
  assert.match(fallback[1], /This does not mean that no evidence exists/);
  assert.match(fallback[1], /href="\.\/paper-trails\.html"/);
  assert.match(fallback[1], /href="\.\/index\.html"/);
  assert.match(fallback[1], /Other interactive pages may also require JavaScript/);
  assert.match(body, /<\/noscript><div class="shell">/);
  assert.match(body, /<script>[\s\S]*?<\/script>/);
});

test('resizing reveals a clipped keyboard-focused card without changing selection, zoom or layout', async () => {
  const { get, document, stored, windowListeners } = await createBoard();
  const view = get('viewport'), world = get('world'), card = get('cards').children[1];
  view.clientLeft = view.clientTop = 0; view.clientHeight = 480; view.clientWidth = 320;
  view.getBoundingClientRect = () => ({ left: 0, top: 0 });
  let keyboard = true, bounds = { left: 430, top: 80, right: 604, bottom: 254, width: 174, height: 174 };
  card.matches = selector => selector === '.tile:focus-visible' && keyboard;
  card.getBoundingClientRect = () => bounds;
  card.focus();
  const position = { ...card.style }, before = world.style.transform, status = get('status').textContent;
  windowListeners.resize();
  assert.notEqual(world.style.transform, before);
  assert.match(world.style.transform, /scale\(1\)$/);
  assert.deepEqual(card.style, position);
  assert.equal(card.attributes['aria-pressed'], 'false');
  assert.equal(document.activeElement, card);
  assert.equal(get('status').textContent, status);
  assert.equal(stored.size, 0);
  bounds = { left: 138, top: 80, right: 312, bottom: 254, width: 174, height: 174 };
  const revealed = world.style.transform;
  windowListeners.resize();
  assert.equal(world.style.transform, revealed, 'an already visible card remains still');
  keyboard = false;
  bounds.left = 430; bounds.right = 604;
  windowListeners.resize();
  assert.equal(world.style.transform, revealed, 'pointer focus must not trigger resize panning');
  keyboard = true;
  card.listeners.pointerdown(pointer(95));
  windowListeners.resize();
  assert.equal(world.style.transform, revealed, 'resizing must not fight an active gesture');
});


test('source trace metadata is explicit when missing or malformed and never assigned to the case card', async () => {
  const writes = [];
  const record = { case_id: '1', title: 'Citation', url: 'https://records.example/doc#page=2', source_id: {}, source_role: ['unknown'] };
  const { get } = await createBoard(undefined, [record], false, undefined, { writeText: async text => writes.push(text) });
  assert.ok(!get('details').children.some(n => n.textContent.includes('Atlas source record ID:')));
  get('cards').children[1].listeners.keydown({ key: 'Enter', preventDefault() {} });
  const details = get('details').children;
  assert.ok(details.some(n => n.textContent.includes('Atlas source record ID: Not recorded') && n.textContent.includes('Indexed association (not a verified relationship): Not recorded')));
  await details.find(n => n.className === 'copy-citation').listeners.click();
  assert.match(writes[0], /Atlas source record ID: Not recorded/);
  assert.match(writes[0], /Indexed association \(not a verified relationship\): Not recorded/);
  assert.match(writes[0], /https:\/\/records\.example\/doc#page=2/);
});

test('Fit all cards frames measured card bounds without moving cards, selection or saved layout', async () => {
  const { get, stored, document } = await createBoard();
  const view = get('viewport'), cards = get('cards').children, world = get('world');
  view.clientWidth = 320; view.clientHeight = 540;
  cards.forEach((card, i) => { card.offsetWidth = i ? 174 : 216; card.offsetHeight = i ? 260 : 198; });
  const positions = cards.map(card => ({ ...card.style })), heading = get('details').children[0];
  get('search').focus();
  get('fit-all').listeners.click();
  const values = world.style.transform.match(/translate\(([^p]+)px,([^p]+)px\) scale\(([^)]+)\)/).slice(1).map(Number);
  const [x,y,z] = values;
  assert.ok(z > 0 && z <= 1);
  for (const card of cards) {
    const left = x + parseFloat(card.style.left)*z, top = y + parseFloat(card.style.top)*z;
    assert.ok(left >= 15.99 && top >= 15.99);
    assert.ok(left + card.offsetWidth*z <= 304.01 && top + card.offsetHeight*z <= 524.01);
  }
  assert.deepEqual(cards.map(card => ({ ...card.style })), positions);
  assert.equal(get('details').children[0], heading);
  assert.equal(document.activeElement, get('search'));
  assert.equal(stored.size, 0);
  assert.match(get('status').textContent, /View fitted to show all cards/);
  get('zout').listeners.click();
  assert.ok(Number(world.style.transform.match(/scale\(([^)]+)\)/)[1]) <= z, 'zoom-out after fitting cannot enlarge the view');
});

test('Fit all cards stays unavailable without a rendered investigation', async () => {
  for (const page of [await createBoard([], []), await createBoard(undefined, undefined, true)]) {
    assert.equal(page.get('fit-all').disabled, true);
    const before = page.get('world').style.transform;
    page.get('fit-all').listeners.click();
    assert.equal(page.get('world').style.transform, before);
  }
});

test('shared citation inspector links only other published cases with the same exact safe URL', async () => {
  const cases = [{id:1,title:'First'},{id:2,title:'Second'},{id:3,title:'Different page'},{id:4,title:'Different query'}];
  const url = 'https://records.example.org/doc?id=1#page=2';
  const refs = [{case_id:1,title:'Citation',url},{case_id:2,title:'Other citation',url},{case_id:2,title:'Duplicate',url},{case_id:3,url:url.replace('page=2','page=3')},{case_id:4,url:url.replace('id=1','id=2')},{case_id:99,url}];
  const {get,location,document,stored} = await createBoard(cases, refs);
  get('cards').children[1].listeners.keydown({key:'Enter',preventDefault(){}});
  const group = get('details').children.find(n=>n.className==='shared-citations');
  assert.ok(group);
  assert.match(group.children[0].textContent,/1 other published case$/);
  assert.match(group.children[1].textContent,/not independent corroboration/);
  assert.deepEqual(group.children[2].children.map(n=>n.textContent),['Second']);
  group.children[2].children[0].listeners.click();
  assert.equal(get('heading').textContent,'Second');
  assert.equal(location.hash,'#case=2');
  assert.equal(document.activeElement,get('details').children[0]);
  assert.equal(stored.size,0);
  assert.ok(!get('details').children.some(n=>n.className==='shared-citations'));
});

test('shared citation inspector caps other published cases and discloses the total', async () => {
  const cases = Array.from({length:11},(_,i)=>({id:i+1,title:'Case '+(i+1)}));
  const refs = cases.map(c=>({case_id:c.id,title:'Citation',url:'https://records.example.org/doc#page=2'}));
  const {get} = await createBoard(cases,refs);
  get('cards').children[1].listeners.keydown({key:'Enter',preventDefault(){}});
  const group=get('details').children.find(n=>n.className==='shared-citations');
  assert.equal(group.children[2].children.length,8);
  assert.equal(group.children[3].textContent,'Showing 8 of 10 other published cases.');
});


test('Show more reveals bounded batches, focuses the first new result and preserves the open board', async () => {
  const published = Array.from({ length: 41 }, (_, i) => ({ id: String(i+1), title: 'Case ' + (i+1) }));
  const { get, document, stored } = await createBoard(published, []);
  const list=get('cases'), more=get('more-cases'), card=get('cards').children[0], details=get('details').children[0];
  assert.equal(more.hidden, false);
  const initialButtons = [...list.children];
  more.listeners.click();
  assert.equal(list.children.length, 36);
  assert.ok(initialButtons.every((button, i) => list.children[i] === button), 'expanding retains the initial case buttons');
  const firstTwoBatches = [...list.children];
  assert.equal(document.activeElement, list.children[18]);
  assert.match(get('case-search-status').textContent, /36 of 41/);
  more.listeners.click();
  assert.equal(list.children.length, 41);
  assert.ok(firstTwoBatches.every((button, i) => list.children[i] === button), 'final expansion retains both previous batches');
  assert.equal(document.activeElement, list.children[36]);
  assert.equal(more.hidden, true);
  more.listeners.click();
  assert.equal(list.children.length, 41);
  assert.equal(get('cards').children[0], card);
  assert.equal(get('details').children[0], details);
  assert.equal(stored.size, 0);
  get('search').value='Case';
  get('search').listeners.input({ target: get('search') });
  assert.equal(list.children.length, 18);
  assert.equal(more.hidden, false);
});

test('Show more remains unavailable for empty, failed and fully displayed searches', async () => {
  for (const board of [await createBoard([], []), await createBoard(undefined, undefined, true), await createBoard()]) {
    const { get }=board;
    assert.equal(get('more-cases').hidden, true);
    const count=get('cases').children.length;
    get('more-cases').listeners.click();
    assert.equal(get('cases').children.length, count);
  }
});


test('new queries and Clear reset the case-list scroll without replacing the open board', async () => {
  const published=Array.from({ length: 41 }, (_,i)=>({ id:String(i+1), title:'Case '+(i+1) }));
  const { get, document }=await createBoard(published, []);
  const list=get('cases'), search=get('search'), card=get('cards').children[0];
  list.scrollTop=500;
  search.value='Case'; search.listeners.input({ target:search });
  assert.equal(list.scrollTop,0);
  list.scrollTop=160;
  get('more-cases').listeners.click();
  assert.equal(list.scrollTop,160, 'expansion does not explicitly reset prior scroll');
  assert.equal(document.activeElement,list.children[18]);
  list.scrollTop=700;
  get('clear-cases').listeners.click();
  assert.equal(list.scrollTop,0);
  assert.equal(document.activeElement,search);
  assert.equal(get('cards').children[0],card);
});


test('repeated titles retain distinct record labels across batches, search and selection', async () => {
  const published=[{id:1,title:'Repeated'}, ...Array.from({length:18},(_,i)=>({id:i+2,title:'Unique '+i})), {id:'record-20',title:' REPEATED '}];
  const original=JSON.stringify(published);
  const {get,location}=await createBoard(published,[]);
  assert.equal(get('cases').children[0].textContent,'Repeated · Case ID 1', 'identify repeats beyond the initial batch');
  assert.equal(get('cases').children[1].textContent,'Unique 0');
  assert.equal(get('details').children[1].textContent,'Published case · Case ID 1');
  const first=get('cases').children[0];
  get('more-cases').listeners.click();
  assert.equal(get('cases').children[0],first);
  assert.equal(get('cases').children.at(-1).textContent,' REPEATED  · Case ID record-20');
  get('search').value='Repeated'; get('search').listeners.input({target:get('search')});
  assert.deepEqual(get('cases').children.map(n=>n.textContent),['Repeated · Case ID 1',' REPEATED  · Case ID record-20']);
  get('cases').children[1].listeners.click();
  assert.equal(location.hash,'#case=record-20');
  assert.equal(get('heading').textContent,' REPEATED ');
  assert.equal(get('details').children[1].textContent,'Published case · Case ID record-20');
  assert.equal(get('cases').children[1].attributes['aria-pressed'],'true');
  get('clear-cases').listeners.click();
  assert.equal(get('cases').children[0].textContent,'Repeated · Case ID 1');
  assert.equal(JSON.stringify(published),original, 'labels do not mutate titles or record IDs');
});

test('shared citation navigation uses the same repeated-title labels and literal record IDs', async () => {
  const id='<record&2>', url='https://records.example.org/shared';
  const {get,location}=await createBoard([{id:1,title:'Same title'},{id,title:'Same title'},{id:3,title:'Unique'}], [{case_id:1,url},{case_id:id,url}]);
  get('cards').children[1].listeners.keydown({key:'Enter',preventDefault(){}});
  const group=get('details').children.find(n=>n.className==='shared-citations');
  const link=group.children[2].children[0];
  assert.equal(link.textContent,'Same title · Case ID <record&2>');
  assert.equal(get('cases').children[1].textContent,link.textContent);
  assert.equal(link.children.length,0, 'IDs remain literal text, never markup');
  link.listeners.click();
  assert.equal(location.hash,'#case='+encodeURIComponent(id));
  assert.equal(get('details').children[1].textContent,'Published case · Case ID <record&2>');
});


test('exact #Case ID search separates same-title records without changing the open board', async () => {
  const {get,location,stored}=await createBoard([{id:3,title:'Project BLUEBIRD'},{id:32,title:'Project BLUEBIRD'},{id:'record-Ab',title:'Other'},{id:132,title:'Case 32'}],[]);
  const card=get('cards').children[0], details=get('details').children[0];
  const search=get('search'), list=get('cases');
  for (const [query,expected] of [[' #32 ',['32']],['#3',['3']],['# 32',['32']],['#record-Ab',['record-Ab']],['#record-ab',[]],['#032',[]],['#',[]],['#999',[]],['32',['132']],['BLUEBIRD',['3','32']]]) {
    search.value=query;search.listeners.input({target:search});
    assert.deepEqual(list.children.map(n=>n.dataset.caseId),expected,query);
    assert.equal(get('cards').children[0],card);
    assert.equal(get('details').children[0],details);
    assert.equal(stored.size,0);
  }
  search.value='#32';search.listeners.input({target:search});list.children[0].listeners.click();
  assert.equal(location.hash,'#case=32');
  assert.equal(get('details').children[1].textContent,'Published case · Case ID 32');
  get('clear-cases').listeners.click();assert.equal(list.children.length,4);
  assert.match(html,/id="case-search-help"[^>]*>Search by title, or enter # followed by an exact Case ID/);
});
