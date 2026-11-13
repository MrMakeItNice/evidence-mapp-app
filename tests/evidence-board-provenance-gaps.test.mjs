// Run: node --test tests/evidence-board-provenance-gaps.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../evidence-board.html',import.meta.url),'utf8');
test('Source inspector explicitly discloses incomplete citation metadata',()=>{
  assert.match(html,/\['publisher','publication_date','reference_code'\]\.filter/);
  assert.match(html,/Metadata incomplete:/);
  assert.match(html,/Check the original source before relying on this citation/);
});
test('Complete metadata never implies the evidence has been verified',()=>{
  assert.match(html,/source authenticity and claim support still require independent verification/);
  assert.match(html,/Indexed source citation · not independently verified/);
});
