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

async function createBoard() {
  const elements = new Map(), stored = new Map();
  const make = tag => ({
    tag, children: [], style: {}, attributes: {}, listeners: {}, textContent: '', className: '',
    focus() { document.activeElement = this; }, setPointerCapture() {},
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
      ? { references: [citation] } : [{ id: '1', title: 'Published case' }] })
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
  card.listeners.pointerdown({ clientX: 0, clientY: 0, pointerId: 1, stopPropagation() {} });
  card.listeners.pointerup();
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
  cards[1].listeners.pointerdown({ clientX: 0, clientY: 0, pointerId: 1, stopPropagation() {} });
  cards[1].listeners.pointerup(); check(1);
  assert.equal(document.activeElement, marker, 'pointer selection must not move focus');
  cards[1].listeners.pointerdown({ clientX: 0, clientY: 0, pointerId: 1, stopPropagation() {} });
  cards[1].listeners.pointerup(); check(1);
  get('selected-record').listeners.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(document.activeElement, cards[1]);
});
