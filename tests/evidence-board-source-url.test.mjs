import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'evidence-board.html'), 'utf8');
const helper = html.match(/function safeSourceUrl\(value\)\{.*?\}catch\{return null\}\}/s);
assert.ok(helper, 'Evidence Board must expose the source URL validation helper');
const safeSourceUrl = runInNewContext(`(${helper[0]})`, { URL });

test('accepts absolute HTTP(S) source documents', () => {
  assert.equal(safeSourceUrl('https://example.org/archive?id=1'), 'https://example.org/archive?id=1');
  assert.equal(safeSourceUrl('http://example.org/document'), 'http://example.org/document');
});

test('rejects script, data, local, relative and malformed URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd',
    '//example.org/document', '/document', 'not a url', '', null, 'mailto:a@example.org']) {
    assert.equal(safeSourceUrl(url), null, `Expected rejected source: ${url}`);
  }
});

test('source filtering and double-click both use the same URL guard', () => {
  assert.match(html, /refs=data\.references\.filter\(r=>r&&r\.case_id&&safeSourceUrl\(r\.url\)\)/);
  assert.match(html, /card\.addEventListener\('dblclick',\(\)=>\{if\(!n\.case&&safeSourceUrl\(n\.item\.url\)\)window\.open\(safeSourceUrl\(n\.item\.url\)/);
});
