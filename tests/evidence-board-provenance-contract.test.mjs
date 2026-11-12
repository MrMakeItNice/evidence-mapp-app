// Run: node tests/evidence-board-provenance-contract.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../evidence-board.html', import.meta.url), 'utf8');
const checks = [
  ['published cases loaded from service', /fetch\(api\)/],
  ['source citations loaded from repository data', /fetch\('\.\/paper-trails-data\.json'\)/],
  ['source records linked by case ID', /String\(r\.case_id\)===String\(id\)/],
  ['citation edges only', /Only source citations are connected/],
  ['no misconduct inference', /does not establish causation or misconduct/],
  ['metadata not falsely presented as scanned documents', /indexed metadata, not original scans/],
  ['no invented evidence on service failure', /No sample evidence has been substituted/],
  ['no production writes in evidence board', /localStorage\.setItem\(layoutKey\(\)/],
];
for (const [label, pattern] of checks) {
  assert.match(html, pattern, label);
  console.log('PASS', label);
}
assert.doesNotMatch(html, /fetch\([^)]*,\s*\{\s*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i, 'board must not write remote data');
console.log('PASS read-only remote data');
