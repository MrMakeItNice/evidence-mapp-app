// Offline regression tests for the private workspace's Add document ingestion path.
// Run: node --test tests/workspace-source-ingestion.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'workspace.html'), 'utf8');
const urlStart = html.indexOf('const targetUrl = u=>');
const urlEnd = html.indexOf('const sourceAnchor =', urlStart);
const formStart = html.indexOf('function addSource(slug){');
const formEnd = html.indexOf('function addEvent(slug)', formStart);
assert.ok(urlStart >= 0 && urlEnd > urlStart, 'shared URL validator exists');
assert.ok(formStart >= 0 && formEnd > formStart, 'document ingestion handler exists');
const code = html.slice(urlStart, urlEnd) + '\n' + html.slice(formStart, formEnd) +
  '\naddSource("sample-group");';

function setup({ existingId = null } = {}) {
  const calls = [];
  let submit;
  const context = {
    URL,
    currentGroup: () => ({ slug: 'sample-group' }),
    field: () => '',
    topicOpts: () => '',
    groupModal: (_heading, _fields, cb) => { submit = cb; },
    finalize: async () => { calls.push({ action: 'finalize' }); },
    client: {
      from(table) {
        if (table === 'sources') return {
          select() {
            return {
              eq(_column, value) {
                calls.push({ action: 'lookup', url: value });
                return { limit: async () => ({
                  data: existingId ? [{ id: existingId }] : [], error: null
                }) };
              }
            };
          },
          insert(record) {
            calls.push({ action: 'insert-source', record });
            return { select() { return { single: async () =>
              ({ data: { id: 17 }, error: null }) }; } };
          }
        };
        if (table === 'investigation_group_sources') return {
          async insert(record) {
            calls.push({ action: 'link-source', record });
            return { error: null };
          }
        };
        throw Error('Unexpected database table: ' + table);
      }
    }
  };
  vm.runInNewContext(code, context, { filename: 'workspace-source-ingestion.js' });
  assert.equal(typeof submit, 'function');
  const send = url => submit({
    title: 'Government document', url, publisher: 'Agency',
    topic_id: '', relevance_notes: 'Unreviewed primary source'
  });
  return { calls, send };
}

test('rejects misleading, credential-bearing, control-character and unsafe URLs before any DB access', async () => {
  for (const bad of [
    'https://archives.gov@unexpected.example/report',
    'https://user:password@unexpected.example/report',
    'https://archives.gov%40fake@unexpected.example/report',
    'https://example.org\\@unexpected.example/report',
    'https://example.org/report\n@unexpected.example',
    'javascript:alert(1)', 'file:///etc/passwd', '//example.org/report',
    'https:///example.org/report', 'not a URL', ''
  ]) {
    const { calls, send } = setup();
    await assert.rejects(() => send(bad), /absolute HTTP or HTTPS source URL/);
    assert.equal(calls.length, 0, 'invalid URL must not cause DB access: ' + bad);
  }
});

test('normal URL preserves document parameters and uses the same safe string for lookup and insertion', async () => {
  const { calls, send } = setup();
  await send(' https://Records.Example:8443/doc?item=A%2FB&lang=en#page=7 ');
  const expected = 'https://records.example:8443/doc?item=A%2FB&lang=en#page=7';
  assert.equal(calls[0].action, 'lookup');
  assert.equal(calls[0].url, expected);
  assert.equal(calls[1].action, 'insert-source');
  assert.equal(calls[1].record.url, expected);
  assert.equal(calls[1].record.published, false, 'document remains unreviewed');
  assert.equal(calls[2].action, 'link-source');
  assert.equal(calls[2].record.reviewed, false, 'group link remains unreviewed');
  assert.equal(calls[3].action, 'finalize');
});

test('an existing safe URL is reused without creating a duplicate source', async () => {
  const { calls, send } = setup({ existingId: 91 });
  await send('https://example.org/report?id=2');
  assert.equal(calls.filter(c => c.action === 'insert-source').length, 0);
  assert.equal(calls.find(c => c.action === 'link-source').record.source_id, 91);
});
