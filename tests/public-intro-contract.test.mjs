// Read-only regression checks for the public welcome and navigation.
// Run: node tests/public-intro-contract.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const home = readFileSync(new URL('../homepage-v2-preview.html', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const checks = [
  ['approved mission wording', /Preserve the past\.<span>Understand OUR-STORY\.<\/span>Embrace presence\./],
  ['approved sign-off', /class="ea-opening-motto">Make it nice\.<\/p>/],
  ['Madison source text', /Knowledge will forever govern ignorance/],
  ['skip intro control', /id="ea-opening-skip"/],
  ['intro continue control', /id="ea-opening-next"/],
  ['Evidence Board navigation', /href="\.\/evidence-board\.html"/],
  ['Paper Trails navigation', /href="\.\/paper-trails\.html"/],
  ['Connection Explorer navigation', /href="\.\/connection-explorer\.html"/],
  ['public landing redirect', /homepage-v2-preview\.html/],
  ['private workspace bypass', /params\.get\('workspace'\) !== '1'/],
];
for (const [name, pattern] of checks) {
  assert.match(name.includes('redirect') || name.includes('bypass') ? index : home, pattern, name);
  console.log('PASS', name);
}
assert.doesNotMatch(home, /Preserve the knowledge, protect the people, follow the evidence/i);
console.log('PASS outdated intro tagline absent');
