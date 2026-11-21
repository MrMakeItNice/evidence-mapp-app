// Regression for #338: graph node actions must inspect the exact workspace record.
// Run from repo root: node --test tests/workspace-graph-inspection.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'workspace.html'), 'utf8');
const start = html.indexOf('function inspectGraphNode(kind,id){');
const end = html.indexOf('\nfunction nav(k){', start);
assert.ok(start >= 0 && end > start, 'exact-record graph inspector exists');
const helper = html.slice(start, end);

function fixture() {
  const records = {
    cases: [{ id: 'case-a' }],
    sources: [{ id: 'source-a' }, { id: 'source-b' }],
    claims: [{ id: 'claim-a' }, { id: 'claim-b' }],
    people: [{ id: 'person-a' }],
    organizations: [{ id: 'org-a' }]
  };
  const pages = [], focused = [], notices = [], state = { caseId: null };
  const targets = [
    ...records.sources.map(r => ['source', r.id]),
    ...records.claims.map(r => ['claim', r.id]),
    ...records.people.map(r => ['person', r.id]),
    ...records.organizations.map(r => ['organization', r.id])
  ].map(([kind, id]) => ({
    dataset: { graphKind: kind, graphId: id },
    focus() { focused.push(kind + ':' + id); }
  }));
  const inspect = vm.runInNewContext(helper + '\ninspectGraphNode', {
    Object,
    one: (table, id) => (records[table] || []).find(r => String(r.id) === String(id)),
    nav: page => pages.push(page),
    document: { querySelectorAll: selector => {
      assert.equal(selector, '[data-graph-kind][data-graph-id]');
      return targets;
    } },
    state,
    toast: msg => notices.push(msg)
  });
  return { inspect, pages, focused, notices, state };
}

test('source and claim nodes focus their distinct IDs, never an arbitrary index row', () => {
  const app = fixture();
  for (const [kind, id, page] of [
    ['source', 'source-a', 'sources'], ['source', 'source-b', 'sources'],
    ['claim', 'claim-a', 'claims'], ['claim', 'claim-b', 'claims'],
    ['person', 'person-a', 'people'], ['organization', 'org-a', 'people']
  ]) {
    app.inspect(kind, id);
    assert.equal(app.pages.at(-1), page);
    assert.equal(app.focused.at(-1), kind + ':' + id);
  }
  assert.equal(app.focused.length, 6);
  assert.deepEqual(app.notices, []);
});

test('missing or unknown graph nodes cannot redirect to an unrelated record', () => {
  const app = fixture();
  app.inspect('source', 'missing');
  app.inspect('unknown', 'source-a');
  assert.equal(app.pages.length, 0);
  assert.equal(app.focused.length, 0);
  assert.equal(app.notices.length, 2);
  app.inspect('case', 'case-a');
  assert.equal(app.state.caseId, 'case-a');
  assert.equal(app.pages.at(-1), 'cases');
});

test('each graph index exposes an independently focusable record identified by ID', () => {
  assert.match(html, /class="record-card graph-record-target" tabindex="-1" data-graph-kind="claim" data-graph-id="\$\{esc\(x.id\)\}"/);
  assert.match(html, /<tr class="graph-record-target" tabindex="-1" data-graph-kind="source" data-graph-id="\$\{esc\(s.id\)\}"/);
  assert.match(html, /data-graph-kind="person" data-graph-id="\$\{esc\(p.id\)\}"/);
  assert.match(html, /data-graph-kind="organization" data-graph-id="\$\{esc\(o.id\)\}"/);
  assert.match(html, /\.graph-record-target:focus\{outline:/);
  assert.match(html, /case 'graph-node':inspectGraphNode\(b.dataset.kind,b.dataset.id\);break;/);
});

test('click and Enter/Space paths dispatch the same record ID to inspection', async () => {
  const registered = {};
  const calls = [];
  const setup = {
    document: { addEventListener(name, callback) { registered[name] = callback; } },
    inspectGraphNode(kind, id) { calls.push(kind + ':' + id); },
    MouseEvent: class { constructor(type, options) { this.type = type; this.bubbles = options.bubbles; } },
    closeModal() {}
  };
  const clickLine = html.split('\n').find(line => line.startsWith("document.addEventListener('click',async e=>"));
  const keyLine = html.split('\n').find(line => line.startsWith("document.addEventListener('keydown',e=>{const node="));
  assert.ok(clickLine && keyLine, 'workspace uses delegated graph handlers');
  vm.runInNewContext(clickLine + '\n' + keyLine, setup);
  const node = {
    dataset: { action: 'graph-node', kind: 'source', id: 'source-b' },
    dispatchEvent(event) { assert.equal(event.type, 'click'); return registered.click({target: this}); },
    closest(selector) { return selector === '[data-action]' || selector === '[data-action="graph-node"]' ? this : null; }
  };
  await registered.click({ target: node });
  for (const key of ['Enter', ' ']) {
    let prevented = 0;
    registered.keydown({ key, target: node, preventDefault() { prevented++; } });
    assert.equal(prevented, 1);
  }
  assert.deepEqual(calls, ['source:source-b', 'source:source-b', 'source:source-b']);
});
