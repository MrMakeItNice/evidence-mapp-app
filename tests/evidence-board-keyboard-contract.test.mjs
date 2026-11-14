import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../evidence-board.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];

test('Evidence Board inline script parses', () => {
  assert.ok(script, 'inline board script is present');
  assert.doesNotThrow(() => new vm.Script(script));
});

test('focused cards support arrow keys and Shift steps without moving outside board bounds', () => {
  assert.match(script, /card\\.addEventListener\\('keydown',e=>/);
  assert.match(script, /\\['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'\\]\\.includes\\(e\\.key\\)/);
  assert.match(script, /const step=e\\.shiftKey\\?20:10/);
  assert.match(script, /Math\\.max\\(0,Math\\.min\\(1000,n\\.x/);
  assert.match(script, /Math\\.max\\(0,Math\\.min\\(660,n\\.y/);
  assert.match(script, /card\\.style\\.left=n\\.x\\+'px'/);
  assert.match(script, /card\\.style\\.top=n\\.y\\+'px'/);
  assert.match(script, /drawWires\\(\\);\\$\\('status'\\)\\.textContent='Card moved/);
});

test('keyboard selection, Escape and local-only Save layout remain available', () => {
  assert.match(script, /e\\.key==='Enter'\\|\\|e\\.key===' '/);
  assert.match(script, /e\\.key==='Escape'\\)\\{card\\.blur\\(\\)/);
  assert.match(script, /localStorage\\.setItem\\(layoutKey\\(\\)/);
  assert.match(html, /Shift for larger steps/);
});
