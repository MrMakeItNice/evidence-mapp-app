// Run: node --test tests/evidence-board-safe-links.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../evidence-board.html',import.meta.url),'utf8');
test('source links allow only HTTP(S) with a hostname',()=>{
 assert.match(html,/function safeSourceUrl\(value\)/);
 assert.match(html,/\['https:','http:'\]\.includes\(u\.protocol\)&&u\.hostname/);
 assert.match(html,/refs=data\.references\.filter\(r=>r&&r\.case_id&&safeSourceUrl\(r\.url\)\)/);
});
test('inspector and double click use sanitized source links',()=>{
 assert.match(html,/const safe=safeSourceUrl\(n\.item\.url\)/);
 assert.match(html,/if\(safe\)window\.open\(safe,'_blank','noopener,noreferrer'\)/);
 assert.match(html,/a\.href=safe;a\.target='_blank';a\.rel='noopener noreferrer'/);
 assert.match(html,/Source link unavailable: only HTTP\(S\) document links can be opened/);
});
