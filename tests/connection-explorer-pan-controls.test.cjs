// Regression checks for Connection Explorer's accessible touch pan controls.
// Run: node --test tests/connection-explorer-pan-controls.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'connection-explorer.html'), 'utf8');
const script = html.split('<script>')[1]?.split('</script>')[0];
assert.ok(script, 'Connection Explorer inline script exists');

test('diagram controls have labelled buttons for all four directions', () => {
  for (const [id, label] of [['panLeft','Pan view left'], ['panRight','Pan view right'], ['panUp','Pan view up'], ['panDown','Pan view down']]) {
    assert.ok(html.includes('id="' + id + '" type="button" aria-label="' + label + '"'), id);
  }
  assert.match(html, /role="group" aria-label="Pan diagram"/);
  assert.match(html, /\.graph-actions \[role=group\] button\{min-width:44px;min-height:44px\}/);
});

test('pan button listeners use the matching view directions', () => {
  for (const [id, direction] of [['panLeft','-1,0'], ['panRight','1,0'], ['panUp','0,-1'], ['panDown','0,1']]) {
    assert.ok(script.includes("$('" + id + "').addEventListener('click',()=>panBy(" + direction + "))"), id);
  }
});

test('pan movement scales with current diagram zoom, not pixels', () => {
  const pan = script.match(/function panBy\(dx,dy\)\{[^}]+\}/)?.[0];
  assert.ok(pan, 'panBy implementation exists');
  const ctx = { view: {x:0,y:0,w:760,h:520}, redraws:0 };
  vm.runInNewContext('function applyView(){redraws++};' + pan + ';this.panBy=panBy', ctx);
  ctx.panBy(-1,0);
  assert.ok(Math.abs(ctx.view.x+136.8)<1e-8);
  ctx.panBy(0,1);
  assert.ok(Math.abs(ctx.view.y-93.6)<1e-8);
  ctx.view = {x:0,y:0,w:380,h:260};
  ctx.panBy(1,0);
  assert.ok(Math.abs(ctx.view.x-68.4)<1e-8);
  ctx.panBy(0,-1);
  assert.ok(Math.abs(ctx.view.y+46.8)<1e-8);
  assert.equal(ctx.redraws,4);
});

test('full inline script parses as JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(script));
});
