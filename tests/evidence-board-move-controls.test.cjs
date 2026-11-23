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
