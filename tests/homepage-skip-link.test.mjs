// Run with: node --test tests/homepage-skip-link.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../homepage-v2-preview.html',import.meta.url),'utf8');
test('public homepage offers keyboard skip navigation before main menu',()=>{
  const skip=html.indexOf('<a class="skip-link" href="#top">Skip to main content</a>');
  const header=html.indexOf('<header class="top">');
  const main=html.indexOf('<main id="top" tabindex="-1">');
  assert.ok(skip>=0 && header>skip && main>header);
});
test('skip link becomes visible when focused',()=>{
  assert.match(html,/\.skip-link\{[^}]*top:-100px/);
  assert.match(html,/\.skip-link:focus\{top:12px\}/);
});
