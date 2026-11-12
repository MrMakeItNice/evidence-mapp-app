// Run: node --test tests/evidence-board-keyboard-positioning.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../evidence-board.html', import.meta.url), 'utf8');
test('Board cards support keyboard selection and arrow movement', () => {
  assert.match(html, /card\.tabIndex=0/);
  assert.match(html, /e\.key==='Enter'\|\|e\.key===' '/);
  for (const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']) assert.ok(html.includes(key), key);
  assert.match(html, /e\.preventDefault\(\);const step=e\.shiftKey\?25:10/);
});
test('Keyboard repositioning stays bounded and redraws source links', () => {
  assert.match(html, /n\.x=Math\.max\(0,Math\.min\(1000,n\.x/);
  assert.match(html, /n\.y=Math\.max\(0,Math\.min\(660,n\.y/);
  assert.match(html, /card\.style\.left=n\.x\+'px';card\.style\.top=n\.y\+'px';drawWires\(\)/);
  assert.match(html, /Shift for larger steps/);
  assert.match(html, /Choose Save layout/);
});
