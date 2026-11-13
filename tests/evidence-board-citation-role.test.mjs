// Run: node --test tests/evidence-board-citation-role.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../evidence-board.html',import.meta.url),'utf8');
const data=JSON.parse(readFileSync(new URL('../paper-trails-data.json',import.meta.url),'utf8'));
test('Indexed citation roles are displayed without being treated as corroboration',()=>{
  assert.match(html,/Index relationship:/);
  assert.match(html,/clean\(n\.item\.source_role\)\|\|'Not recorded'/);
  assert.match(html,/not a verification of the document or its claims/);
});
test('Source role is grounded in reference data rather than inferred from URLs',()=>{
  assert.ok(data.references.some(r=>typeof r.source_role==='string' && r.source_role.length>0));
  assert.match(html,/refs=data\.references\.filter/);
  assert.match(html,/function uniqueDocs\(id\)/);
});
