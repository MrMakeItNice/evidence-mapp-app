// Run: node --test tests/evidence-board-empty-states.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../evidence-board.html',import.meta.url),'utf8');
test('A case with zero indexed sources is not represented as corroborated',()=>{
 assert.match(html,/docs\.length\?docs\.length\+'/);
 assert.match(html,/No indexed source citations are available for this investigation/);
 assert.match(html,/case card is not evidence of corroboration/);
 assert.match(html,/classic connection view to inspect available records/);
});
test('Empty case feed has an explicit honest state',()=>{
 assert.match(html,/No published investigations/);
 assert.match(html,/No published cases available\. No sample evidence has been substituted/);
 assert.match(html,/Could not load public source records/);
});
