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

async function createBoard(publishedCases = [{ id: '1', title: 'Published case' }], references) {
  const elements = new Map(), stored = new Map();
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
  const document = {
    title: html.match(/<title>(.*?)<\/title>/)[1],
    getElementById: get, createElement: make, createElementNS: (_, tag) => make(tag),
    querySelectorAll: () => get('cards').children
  };
  const citation = { case_id: '1', title: 'Original document', url: 'https://records.example.org/archive?id=1' };
  let opened = 0;
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    document, URL, encodeURIComponent,
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    window: { open() { opened++; } },
    fetch: async url => ({ ok: true, json: async () => url.includes('paper-trails-data')
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
