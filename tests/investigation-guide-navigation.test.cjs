// Checks the actual beginner walkthrough in first-investigation-guide.html.
// Run: node --test tests/investigation-guide-navigation.test.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'first-investigation-guide.html'), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'inline guide script exists');

function startGuide() {
  const focusHistory = [];
  class FakeElement {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.textContent = '';
      this.className = '';
      this.disabled = false;
    }
    append(...elements) { this.children.push(...elements); }
    replaceChildren(...elements) { this.children = [...elements]; }
    focus() { focusHistory.push(this); }
  }
  const ids = ['story', 'progress', 'back', 'next', 'guideStatus'];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement()]));
  const document = {
    getElementById(id) {
      assert.ok(elements[id], 'expected existing element: ' + id);
      return elements[id];
    },
    createElement(tag) { return new FakeElement(tag); }
  };
  new vm.Script(match[1], {filename:'first-investigation-guide.html'}).runInNewContext({document});
  return {elements, focusHistory};
}

test('initial step shows accurate progress without stealing focus', () => {
  const {elements, focusHistory} = startGuide();
  assert.equal(elements.guideStatus.textContent, 'Step 1 of 5: Choose your mystery');
  assert.equal(elements.progress.children.length, 5);
  assert.equal(elements.progress.children.filter(x => x.className === 'on').length, 1);
  assert.equal(elements.back.disabled, true);
  assert.equal(focusHistory.length, 0);
});

test('Next/Previous move focus to the new heading and update status', () => {
  const {elements, focusHistory} = startGuide();
  elements.next.onclick();
  assert.equal(elements.guideStatus.textContent, 'Step 2 of 5: Find your clues');
  assert.equal(elements.progress.children.filter(x => x.className === 'on').length, 2);
  assert.equal(elements.story.children[1].tag, 'h2');
  assert.equal(elements.story.children[1].tabIndex, -1);
  assert.equal(focusHistory.at(-1), elements.story.children[1]);
  assert.equal(elements.back.disabled, false);
  elements.back.onclick();
  assert.equal(elements.guideStatus.textContent, 'Step 1 of 5: Choose your mystery');
  assert.equal(focusHistory.at(-1), elements.story.children[1]);
  assert.equal(elements.back.disabled, true);
});

test('last step is labeled Start again and wraps without losing heading focus', () => {
  const {elements, focusHistory} = startGuide();
  for (let i = 0; i < 4; i++) elements.next.onclick();
  assert.equal(elements.guideStatus.textContent, 'Step 5 of 5: Build your case file');
  assert.equal(elements.progress.children.filter(x => x.className === 'on').length, 5);
  assert.equal(elements.next.textContent, 'Start again ↺');
  elements.next.onclick();
  assert.equal(elements.guideStatus.textContent, 'Step 1 of 5: Choose your mystery');
  assert.equal(elements.next.textContent, 'Next step →');
  assert.equal(focusHistory.length, 5);
  assert.equal(focusHistory.at(-1), elements.story.children[1]);
});

test('the source-inspection path labels citation metadata instead of equating it with proof', () => {
  assert.match(html, /href="\.\/evidence-board\.html">Inspect the Evidence Board/);
  assert.match(html, /Evidence Board cards are citation metadata, not proof/);
  assert.match(html, /read the original documents before relying on them/);
  assert.match(html, /id="guideStatus" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(html, /id="progress" aria-hidden="true"/);
  assert.match(html, /<div id="story"><\/div>/);
  assert.match(html, /\.paper h2:focus\{outline:/);
});
