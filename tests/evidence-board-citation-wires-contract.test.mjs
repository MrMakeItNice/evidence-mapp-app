import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../evidence-board.html', import.meta.url), 'utf8');

test('Evidence Board labels connections as citations, not allegations', () => {
  assert.match(html, /Only source citations are connected\. An edge does not establish causation or misconduct\./);
  assert.match(html, /No invented images or relationships\./);
});

test('Evidence Board wires connect displayed sources only to their parent case', () => {
  assert.match(html, /nodes\.slice\(1\)\.forEach\(n=>\{/);
  assert.match(html, /nodes\[0\]\.x/);
  assert.match(html, /nodes\[0\]\.y/);
  assert.match(html, /const docs=uniqueDocs\(active\.id\)/);
});

test('Evidence Board citation list filters by case and deduplicates URLs', () => {
  assert.match(html, /String\(r\.case_id\)===String\(id\)/);
  assert.match(html, /const seen=new Set\(\)/);
  assert.match(html, /if\(seen\.has\(key\)\)return false/);
  assert.match(html, /\.slice\(0,12\)/);
});
