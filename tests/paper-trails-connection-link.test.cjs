const assert = require('node:assert/strict');
const fs = require('node:fs');

const archive = fs.readFileSync('paper-trails.html', 'utf8');
const explorer = fs.readFileSync('connection-explorer.html', 'utf8');
const script = archive.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'Paper Trails inline script exists');
assert.doesNotThrow(() => new Function(script), 'Paper Trails script parses');
assert.match(explorer, /new URLSearchParams\(location\.hash\.slice\(1\)\)\.get\('case'\)/,
  'Connection Explorer accepts #case=<id> deep links');

const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: '', innerHTML: '', textContent: '',
    addEventListener() {}, focus() {}, scrollIntoView() {}
  });
  return elements.get(id);
}
let latestHash;
const app = new Function('document', 'window', 'history', 'location', 'fetch', script +
  ';return {openCase, setData:(c,r)=>{cases=c;refs=r}}')(
  {getElementById: element},
  {addEventListener() {}},
  {replaceState(_state, _title, hash) {latestHash = hash;}},
  {hash: ''},
  () => new Promise(() => {}) // Keep background fetch pending: no network or production writes.
);

app.setData([
  {id:42, case_number:2, title:'Research <File>', category:'Documented'},
  {id:99, case_number:31, title:'Other public case', category:'Documented'}
], []);

app.openCase(42);
assert.match(element('detail').innerHTML, /href="\.\/connection-explorer\.html#case=42"/);
assert.match(element('detail').innerHTML, /shared source records, not proof of coordinated activity/);
assert.match(element('detail').innerHTML, /Research &lt;File&gt;/);
assert.doesNotMatch(element('detail').innerHTML, /Research <File>/);
assert.equal(latestHash, '#case-42');

app.openCase(99);
assert.match(element('detail').innerHTML, /href="\.\/connection-explorer\.html#case=99"/);
assert.doesNotMatch(element('detail').innerHTML, /href="\.\/connection-explorer\.html#case=42"/);
assert.equal(latestHash, '#case-99');

console.log('PASS: each published case links to its matching read-only citation network; provenance caveat and HTML escaping preserved.');
