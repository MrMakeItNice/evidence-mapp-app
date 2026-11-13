// Run: node --test tests/evidence-board-source-url.test.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../evidence-board.html'),'utf8');
const match=html.match(/function safeSourceUrl\(value\)\{.*?\}catch\{return null\}\}/);
assert.ok(match,'safeSourceUrl helper must exist');
const safe=vm.runInNewContext('('+match[0]+')',{URL});
test('only absolute HTTP(S) source URLs are accepted',()=>{
 assert.equal(safe('https://example.org/report'),'https://example.org/report');
 assert.equal(safe('http://example.org/'), 'http://example.org/');
 for(const value of ['javascript:alert(1)','data:text/html,evil','file:///etc/passwd','//example.org/path','/relative','not a URL','']) assert.equal(safe(value),null,value);
});
test('source records and outbound links use URL validation',()=>{
 assert.match(html,/refs=data\.references\.filter\(r=>r&&r\.case_id&&safeSourceUrl\(r\.url\)\)/);
 assert.match(html,/a\.href=safeSourceUrl\(n\.item\.url\)/);
 assert.match(html,/window\.open\(safeSourceUrl\(n\.item\.url\)/);
});
