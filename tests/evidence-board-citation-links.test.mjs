// Run: node --test tests/evidence-board-citation-links.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../evidence-board.html',import.meta.url),'utf8');

test('source inspector labels edges as citations, not confirmed claims',()=>{
  assert.match(html,/Relationship: this source is indexed as a citation/);
  assert.match(html,/not corroboration, agreement, causation, or evidence of wrongdoing/);
  assert.match(html,/Lines represent citation links only, not verified relationships/);
});

test('citation disclosure is tied to source inspection and retains provenance metadata',()=>{
  assert.match(html,/if\(!n\.case\)\{const meta=/);
  assert.match(html,/Publication date:/);
  assert.match(html,/Reference:/);
  assert.match(html,/d\.append\(relation\)/);
  assert.match(html,/Open original source/);
});
