// Regression checks for the actual Connections Map controls in workspace.html.
// Run from repository root: node --test tests/workspace-network-controls.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'workspace.html'), 'utf8');
const start = html.indexOf('function adjustNetworkView(mode){');
const end = html.indexOf('function solutionsScreen(){', start);
assert.ok(start >= 0 && end > start, 'Connections Map view helper exists');

function app() {
  let viewBox = '0 0 1100 665';
  const status={textContent:''};
  const svg = {
    contains(node) { return node?.belongs===true; },
    getAttribute(name) { assert.equal(name, 'viewBox'); return viewBox; },
    setAttribute(name, value) { assert.equal(name, 'viewBox'); viewBox = value; }
  };
  const adjust = vm.runInNewContext(
    html.slice(start, end) + ';adjustNetworkView',
    { $: id => id === 'connectionsSvg' ? svg : id === 'network-view-status' ? status : null }
  );
  const reveal=vm.runInNewContext(html.slice(start,end)+';revealNetworkNode',{$:id=>id==='connectionsSvg'?svg:id==='network-view-status'?status:null});
  return { adjust, reveal, status, read: () => viewBox.split(' ').map(Number) };
}

test('seven accessible controls are wired to the map rather than the case nodes', () => {
  assert.match(html, /<svg id="connectionsSvg" class="network-svg"/);
  for (const mode of ['in', 'out', 'left', 'right', 'up', 'down', 'fit']) {
    assert.ok(html.includes('data-action="network-view" data-view="' + mode + '" aria-controls="connectionsSvg"'), mode);
  }
  assert.match(html, /class="network-tools" role="group" aria-label="Connections map navigation"/);
  assert.match(html, /\.network-tools button\{min-height:44px/);
  assert.match(html, /case 'network-view':adjustNetworkView\(b\.dataset\.view\);break;/);
  assert.match(html, /data-action="graph-node"/);
});

test('zoom preserves the map centre and its aspect ratio', () => {
  const { adjust, read } = app();
  adjust('in');
  const [x, y, w, h] = read();
  assert.equal(w, 880);
  assert.equal(h, 532);
  assert.equal(x, 110);
  assert.equal(y, 66.5);
  adjust('out');
  assert.deepEqual(read(), [0, 0, 1100, 665]);
});

test('pan controls move in the requested directions', () => {
  const { adjust, read } = app();
  adjust('left'); assert.ok(read()[0] < 0);
  adjust('fit');
  adjust('right'); assert.ok(read()[0] > 0);
  adjust('fit');
  adjust('up'); assert.ok(read()[1] < 0);
  adjust('fit');
  adjust('down'); assert.ok(read()[1] > 0);
});

test('zoom remains bounded and fit restores the original map', () => {
  const { adjust, read } = app();
  for (let i = 0; i < 50; i++) adjust('in');
  assert.equal(read()[2], 350);
  for (let i = 0; i < 50; i++) adjust('out');
  assert.equal(read()[2], 1760);
  adjust('fit');
  assert.deepEqual(read(), [0, 0, 1100, 665]);
});

test('unknown controls do not change view and missing SVG is safe', () => {
  const { adjust, read } = app();
  adjust('__proto__');
  assert.deepEqual(read(), [0, 0, 1100, 665]);
  const missing = vm.runInNewContext(html.slice(start, end) + ';adjustNetworkView', { $: () => null });
  assert.doesNotThrow(() => missing('left'));
});

test('workspace inline JavaScript still parses', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [i, match] of scripts.entries()) {
    if (match[1].trim()) new vm.Script(match[1], { filename: 'workspace-script-' + i });
  }
});


test('map actions expose zoom and position without moving focus', () => {
  assert.match(html, /id="network-view-status" role="status" aria-atomic="true"/);
  assert.match(html, /aria-label="Connections map navigation" aria-describedby="network-view-status"/);
  const {adjust,status}=app();
  adjust('in'); assert.match(status.textContent, /Zoom: 125%.*50% across, 50% down/);
  const beforePan=status.textContent;
  adjust('left'); assert.match(status.textContent, /Zoom: 125%.*34% across, 50% down/);
  assert.notEqual(status.textContent,beforePan);
  adjust('down'); assert.match(status.textContent, /34% across, 66% down/);
  adjust('fit'); assert.match(status.textContent, /Zoom: 100%.*50% across, 50% down/);
  const reset=status.textContent;adjust('invalid');assert.equal(status.textContent,reset);
});

test('SVG relationship nodes are keyboard reachable and visibly focusable', () => {
  assert.match(html, /<svg id="connectionsSvg" class="network-svg" role="group" aria-label="Recorded investigation relationships"/);
  assert.match(html, /<g data-action="graph-node" data-kind="\$\{n.kind\}" data-id="\$\{n.id\}" role="button" tabindex="0" aria-label="Inspect \$\{esc\(n.kind\)\}: \$\{esc\(n.title\)\}"/);
  assert.match(html, /\.network-svg \[data-action="graph-node"\]:focus-visible > circle:first-of-type\{stroke:/);
});

test('Enter and Space inspect focused relationship nodes without overriding other keys', () => {
  const line = html.split('\n').find(s => s.startsWith("document.addEventListener('keydown',e=>{const node="));
  assert.ok(line, 'delegated map keyboard handler exists');
  let handler, closed = 0;
  vm.runInNewContext(line, {
    document: { addEventListener(type, fn) { assert.equal(type, 'keydown'); handler = fn; } },
    MouseEvent: class { constructor(type, options) { this.type = type; this.bubbles = options.bubbles; } },
    closeModal() { closed++; }
  });
  const events = [];
  const node = { dispatchEvent(event) { events.push([event.type, event.bubbles]); } };
  let prevented = 0;
  const target = { closest(selector) { assert.equal(selector, '[data-action="graph-node"]'); return node; } };
  for (const key of ['Enter', ' ', 'ArrowLeft', 'Escape']) {
    handler({ key, target, preventDefault() { prevented++; } });
  }
  assert.equal(prevented, 2, 'only activation keys are intercepted');
  assert.equal(events.length, 2);
  assert.ok(events.every(([type, bubbles]) => type === 'click' && bubbles === true));
  assert.equal(closed, 1, 'Escape continues to close a modal');
  handler({ key: 'Enter', target: { closest() { return null; } }, preventDefault() { throw Error('Unrelated controls must not be intercepted'); } });
  assert.equal(events.length, 2, 'unrelated inputs are left alone');
});


test('keyboard focus reveals offscreen nodes at every edge without changing zoom', () => {
 const {adjust,reveal,read,status}=app();
 const node=(cx,cy)=>({belongs:true,querySelector:()=>({getAttribute:name=>String(name==='cx'?cx:cy)})});
 for(const [cx,cy] of [[100,100],[1000,100],[100,600],[1000,600]]){
  adjust('fit');for(let i=0;i<6;i++)adjust('in');
  const before=read();reveal(node(cx,cy));const [x,y,w,h]=read();
  assert.equal(w,before[2]);assert.equal(h,before[3]);
  assert.ok(cx>=x+40-1e-8&&cx<=x+w-40+1e-8);
  assert.ok(cy>=y+40-1e-8&&cy<=y+h-40+1e-8);
  assert.match(status.textContent,/Zoom: 314%/);
 }
 adjust('fit');const initial=read();reveal(node(550,332.5));assert.deepEqual(read(),initial);
 reveal({...node(1000,600),belongs:false});assert.deepEqual(read(),initial);
 reveal(node(NaN,100));assert.deepEqual(read(),initial);
 reveal({belongs:true,querySelector:()=>null});assert.deepEqual(read(),initial);
});

test('focus handler reveals graph nodes without intercepting focus or activating records', () => {
 const line=html.split('\n').find(s=>s.startsWith("document.addEventListener('focusin',e=>{const node="));
 assert.ok(line);let handler;const calls=[];
 vm.runInNewContext(line,{document:{addEventListener(type,fn){assert.equal(type,'focusin');handler=fn}},revealNetworkNode:node=>calls.push(node)});
 const node={};handler({target:{closest:()=>node}});assert.deepEqual(calls,[node]);
 handler({target:{closest:()=>null}});handler({target:{}});assert.equal(calls.length,1);
});
