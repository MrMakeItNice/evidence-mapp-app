// Regression tests for #339. Run from repo root: node --test tests/news-updates-link-safety.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const js = fs.readFileSync(path.join(__dirname, '..', 'news-updates.js'), 'utf8');
const helpers = ['escape', 'safe', 'link'].map(name => {
  const line = js.split('\n').find(line => line.trim().startsWith('const '+name+'='));
  assert.ok(line, 'news-updates helper '+name+' exists');
  return line;
}).join('\n');
const {safe, link} = vm.runInNewContext(helpers + '\n({safe,link})', {URL});

test('accepts ordinary HTTP and HTTPS citations without rewriting them', () => {
  for (const url of ['https://www.archives.gov/doc?id=42#page=2', 'https://records.example.org:8443/report', 'http://archive.example.org/legacy']) {
    assert.equal(safe(url), url);
  }
});

test('rejects userinfo-bearing source links and misleading apparent hostnames', () => {
  for (const url of [
    'https://reader@archives.gov/document', 'https://reader:password@archives.gov/document',
    'https://:password@archives.gov/document', 'https://archives.gov@untrusted.example/document',
    'https://%75ser:password@archives.gov/document', 'http://reader@archives.gov/document'
  ]) assert.equal(safe(url), null, url);
});

test('rejects relative, script, data and invalid source URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//archives.gov/doc', '/local/doc', 'not a url', '', null]) {
    assert.equal(safe(url), null, String(url));
  }
});

test('blocked sources render as escaped plain-text labels, not links', () => {
  assert.equal(link('https://reader:password@archives.gov/doc', 'Account & report'), 'Account &amp; report');
  assert.equal(link('javascript:alert(1)', '<unsafe>'), '&lt;unsafe&gt;');
});

test('allowed source labels and links are escaped and use safe anchor attributes', () => {
  const markup = link('https://archives.gov/?a=1&b=2', '<Archive & records>');
  assert.match(markup, /^<a href="https:\/\/archives\.gov\/\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">&lt;Archive &amp; records&gt; ↗<\/a>$/);
  assert.match(js, /sources\.map\(s=>'<li>'\+link\(s\.url,s\.label\)/);
});

test('news update JavaScript remains syntactically valid', () => {
  assert.doesNotThrow(() => new vm.Script(js));
});