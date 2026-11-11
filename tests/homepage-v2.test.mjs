// Run with: node --test tests/homepage-v2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync(new URL('../homepage-v2-preview.html', import.meta.url),'utf8');
test('preserves original Madison power quote and attribution',()=>{
  assert.ok(html.includes('“The accumulation of all powers, legislative, executive, and judiciary, in the same hands … may justly be pronounced the very definition of tyranny.”'));
  assert.ok(html.includes('The Federalist No. 47 (1788)'));
});
test('has accessible primary navigation and meaningful destination links',()=>{
  assert.match(html,/<nav aria-label="Primary navigation">/);
  for(const href of ['./discover.html','./connection-explorer.html']) assert.ok(html.includes('href="'+href+'"'));
});
test('Global Evidence Pulse does not fabricate live values',()=>{
  assert.ok(html.includes('Global Evidence Pulse'));
  assert.ok(html.includes('Awaiting verified, deduplicated event counts'));
  assert.ok(html.includes('Not live yet'));
  assert.ok(!/class="stat"[^>]*>[\s\S]*?<strong>\d+<\/strong>/.test(html));
});
test('Solutions Hub and good-news feed accurately show development status',()=>{
  assert.ok(html.includes('Community tools in development'));
  assert.ok(html.includes('Verified story feed coming soon'));
});
test('mobile layout and responsive viewport are present',()=>{
  assert.ok(html.includes('name="viewport"'));
  assert.ok(html.includes('@media(max-width:720px)'));
});
