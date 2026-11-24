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

async function createBoard(publishedCases = [{ id: '1', title: 'Published case' }], references, failedRequest = false, savedLayout, clipboard) {
  const elements = new Map(), stored = new Map();
  if (savedLayout !== undefined) stored.set('atlas-evidence-board-layout-v2-1', savedLayout);
  const make = tag => ({
    tag, children: [], style: {}, attributes: {}, dataset: {}, listeners: {}, textContent: '', className: '',
    focus() { document.activeElement = this; }, blur() { if (document.activeElement === this) document.activeElement = undefined; }, setPointerCapture() {},
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
  get('save').disabled = /<button id="save"[^>]*\bdisabled/.test(html); // Initial native HTML state in the simulated DOM.
  const document = {
    title: html.match(/<title>(.*?)<\/title>/)[1],
    getElementById: get, createElement: make, createElementNS: (_, tag) => make(tag),
    querySelectorAll: () => get('cards').children
  };
  const citation = { case_id: '1', title: 'Original document', url: 'https://records.example.org/archive?id=1' };
  let opened = 0;
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    document, URL, encodeURIComponent, navigator: { clipboard },
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    window: { open() { opened++; } },
    fetch: async url => ({ ok: !failedRequest, json: async () => url.includes('paper-trails-data')
      ? { references: references ?? [citation] } : publishedCases })
  });
  await new Promise(resolve => setImmediate(resolve));
  return { get, stored, document, citation, getOpened: () => opened };
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
  assert.match(html, /id="search"[^>]*aria-describedby="case-search-status" disabled/);
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
  assert.match(body, /^<a class="skip-board" href="#board-controls">Skip to evidence board<\/a><header>/);
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
    reference_code: 'ABC-1', url: 'https://records.example.org/archive?id=1#page=4' };
  const { get, getOpened } = await createBoard(undefined, [record], false, undefined, { writeText: async text => writes.push(text) });
  assert.ok(!get('details').children.some(n => n.className === 'copy-citation'), 'case is not a citation');
  get('cards').children[1].listeners.keydown({ key: 'Enter', preventDefault() {} });
  const children = get('details').children, button = children.find(n => n.className === 'copy-citation');
  const feedback = children.find(n => n.attributes.role === 'status');
  assert.equal(button.type, 'button');
  assert.equal(feedback.attributes['aria-atomic'], 'true');
  await button.listeners.click();
  assert.deepEqual(writes, [
    ['Indexed source citation — not independently verified', 'Title: Archive <scan>', 'Publisher: Agency',
      'Publication date: 1977-08-03', 'Reference: ABC-1', 'Indexed URL: ' + record.url].join('\n')
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
