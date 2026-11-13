// Run: node --test tests/evidence-board-case-search.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../evidence-board.html',import.meta.url),'utf8');
test('Case search trims query and reports capped match count',()=>{
  assert.match(html,/q\.trim\(\)\.toLowerCase\(\)/);
  assert.match(html,/Math\.min\(matches\.length,18\)/);
  assert.match(html,/matches\.slice\(0,18\)/);
});
test('Case search distinguishes no match from no published cases',()=>{
  assert.match(html,/No matching cases\. Try another search\./);
  assert.match(html,/No published cases available\./);
  assert.match(html,/summary\.setAttribute\('role','status'\)/);
  assert.match(html,/box\.replaceChildren\(\)/);
});
