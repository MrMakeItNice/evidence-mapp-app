import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// CI installs this pinned test-only dependency outside the repository.
const { chromium } = await import(process.env.EVIDENCE_BOARD_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.EVIDENCE_BOARD_PLAYWRIGHT_MODULE).href : 'playwright');
const html = await readFile(new URL('../evidence-board.html', import.meta.url), 'utf8');
const cases = [{ id: '1', title: 'Investigation ' + 'UnbrokenTitle'.repeat(25) }];
const references = [
  { case_id: '1', title: 'Browser fixture citation', url: 'https://records.example/document?id=42#page=2', publisher: 'Fixture archive', publication_date: '1977-08-03', reference_code: 'S1', source_id: 204, source_role: 'Annotated research reference' },
  { case_id: '1', title: 'Second page citation', url: 'https://records.example/document?id=42#page=3' },
  { case_id: '1', title: 'Duplicate destination', url: 'https://RECORDS.example:443/document?id=42#page=2' },
  { case_id: '1', title: 'Credential-bearing fixture', url: 'https://records.example@untrusted.example/document' },
  { case_id: '1', title: 'Unsafe scheme fixture', url: 'javascript:alert(1)' },
  { case_id: '2', title: 'Different case citation', url: 'https://records.example/other' },
];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(10000);
  const errors = [], unexpected = [];
  let rejectCaseRequest = false, failedCaseRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://board.example' && url.pathname === '/evidence-board.html')
      return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === 'https://board.example' && url.pathname === '/paper-trails-data.json')
      return route.fulfill({ json: { references } });
    if (url.hostname === 'nxlffnplqdobfqxogmxo.supabase.co' && url.pathname === '/functions/v1/evidence-atlas/api/cases') {
      if (rejectCaseRequest) {
        failedCaseRequests++;
        return route.fulfill({ status: 503, json: { error: 'Fixture service unavailable' }, headers: { 'access-control-allow-origin': '*' } });
      }
      return route.fulfill({ json: cases, headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204 });
    unexpected.push(route.request().url());
    return route.abort();
  });
  await page.goto('https://board.example/evidence-board.html#case=1');
  await page.waitForFunction(() => !document.getElementById('save').disabled);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip-board').first().evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('link', { name: 'Skip to case search', exact: true }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement.id === 'case-files-heading');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => document.activeElement.id === 'search');
  console.log('PASS: second skip link reaches the case-search heading and native Tab enters the search input.');

  const caseSearch = page.getByRole('search', { name: 'Published cases', exact: true });
  assert.equal(await caseSearch.count(), 1, 'case search exposes a named landmark');
  const searchbox = caseSearch.getByRole('searchbox', { name: 'Search published cases', exact: true });
  assert.equal(await searchbox.count(), 1);
  assert.equal(await caseSearch.locator('#case-search-status').count(), 1);
  const searchUrl = page.url();
  const initialCards = await page.locator('.tile').allTextContents();
  await searchbox.fill('No matching investigation');
  assert.equal(await caseSearch.locator('#cases button').count(), 0);
  await searchbox.press('Enter');
  assert.equal(page.url(), searchUrl, 'Enter must not submit or navigate away');
  assert.deepEqual(await page.locator('.tile').allTextContents(), initialCards, 'filtering preserves the open board');
  await caseSearch.getByRole('button', { name: 'Clear search', exact: true }).click();
  assert.equal(await searchbox.inputValue(), '');
  assert.equal(await searchbox.evaluate(el => el === document.activeElement), true);
  assert.equal(await caseSearch.locator('#cases button').count(), cases.length);
  assert.deepEqual(await page.locator('.tile').allTextContents(), initialCards);
  console.log('PASS: named case-search landmark contains controls, status and results; filtering, Enter and Clear preserve the open board.');

  await page.goto('about:blank');
  await page.goto('https://board.example/evidence-board.html#case=1');
  await page.waitForFunction(() => !document.getElementById('save').disabled);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('link', { name: 'Skip to selected record', exact: true }).evaluate(el => el === document.activeElement), true);
  const selectedBeforeSkip = await page.locator('.tile[aria-pressed="true"]').getAttribute('aria-label');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement.id === 'selected-record');
  assert.equal(await page.locator('.tile[aria-pressed="true"]').getAttribute('aria-label'), selectedBeforeSkip);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#details a').first().evaluate(el => el === document.activeElement), true);
  console.log('PASS: third skip link focuses the selected-record inspector and Tab enters its controls without changing selection.');
  await page.goto('about:blank'); // Force a new document, rather than same-page fragment navigation.
  await page.goto('https://board.example/evidence-board.html#case=1');
  await page.waitForFunction(() => !document.getElementById('save').disabled);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip-board').first().evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement.id === 'board-controls');
  const citation = page.locator('.tile').nth(1);
  await citation.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement === document.querySelector('#details h2'));
  await page.keyboard.press('Escape');
  assert.equal(await citation.evaluate(el => el === document.activeElement), true);
  console.log('PASS: native skip-link focus, keyboard source inspection and Escape return.');

  await page.emulateMedia({ forcedColors: 'active' });
  const selection = await citation.evaluate(el => {
    const style = getComputedStyle(el);
    return { forced: matchMedia('(forced-colors: active)').matches, border: style.borderTopStyle,
      width: style.borderTopWidth, shadow: style.boxShadow, outline: style.outlineStyle, offset: style.outlineOffset };
  });
  assert.deepEqual(selection, { forced: true, border: 'double', width: '3px', shadow: 'none', outline: 'solid', offset: '3px' });
  assert.equal(await page.locator('#cases button[aria-pressed="true"]').evaluate(el => getComputedStyle(el).borderTopStyle), 'double');
  await page.emulateMedia({ forcedColors: 'none' });
  assert.equal(await citation.evaluate(el => getComputedStyle(el).borderTopStyle), 'solid');
  console.log('PASS: forced-colors selection borders and separate focus outline; normal border restored.');

  // Returning from the inspector must reveal the selected card without moving evidence.
  for (const [width, height] of [[1280,800], [320,700]]) {
    await page.setViewportSize({ width, height });
    await page.locator('#reset').click();
    const position = await citation.evaluate(el => [el.style.left, el.style.top]);
    const saved = await page.evaluate(() => localStorage.getItem('atlas-evidence-board-layout-v2-1'));
    const zoom = await page.locator('#zoom-level').textContent();
    const board = page.locator('#viewport');
    await board.focus();
    for (let i = 0; i < 16; i++) await page.keyboard.press('Shift+ArrowRight');
    assert.ok(await citation.evaluate(el => el.getBoundingClientRect().left > document.getElementById('viewport').getBoundingClientRect().right),
      'fixture card must be outside the board before locating');
    const locate = page.getByRole('button', { name: 'Find selected card on board' });
    if (width === 320) assert.ok(await locate.evaluate(el => el.getBoundingClientRect().height >= 44), 'locate touch target');
    await locate.click();
    assert.ok(await citation.evaluate(el => {
      const card = el.getBoundingClientRect(), frame = document.getElementById('viewport').getBoundingClientRect();
      return document.activeElement === el && card.left >= frame.left - 1 && card.right <= frame.right + 1 &&
        card.top >= frame.top - 1 && card.bottom <= frame.bottom + 1 &&
        card.bottom > 0 && card.top < innerHeight;
    }), 'locate must reveal and focus the citation in the visible board');
    assert.deepEqual(await citation.evaluate(el => [el.style.left, el.style.top]), position);
    assert.equal(await citation.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#details h2').textContent(), references[0].title);
    assert.equal(await page.locator('#zoom-level').textContent(), zoom);
    assert.equal(await page.evaluate(() => localStorage.getItem('atlas-evidence-board-layout-v2-1')), saved);
  }
  console.log('PASS: locate selected citation at desktop and phone widths without altering card coordinates, zoom, or saved layout.');

  // Verify the actual rendered provenance controls, not only the URL helper.
  assert.equal(await page.locator('.tile').count(), 3, 'case plus exactly two eligible distinct citations');
  assert.match(await page.locator('#citation-count').textContent(), /Showing 2 of 2 unique indexed citation URLs/);
  for (let i = 0; i < 2; i++) {
    const card = page.locator('.tile').nth(i + 1), record = references[i];
    await card.focus();
    await page.keyboard.press('Enter');
    const inspector = page.locator('#details'), link = inspector.locator('a');
    assert.equal(await inspector.locator('h2').textContent(), record.title);
    assert.match(await inspector.locator('.badge').textContent(), /not independently verified/);
    assert.equal(await inspector.locator('.indexed-url').textContent(), 'Indexed URL: ' + record.url);
    const trace = inspector.locator('.source-trace');
    assert.equal(await trace.count(), 1);
    assert.deepEqual((await trace.textContent()).split('\n'), [
      'Publisher: ' + (record.publisher || 'Not recorded'),
      'Publication date: ' + (record.publication_date || 'Not recorded'),
      'Reference: ' + (record.reference_code || 'Not recorded'),
      'Source host: records.example',
      'Atlas source record ID: ' + (record.source_id || 'Not recorded'),
      'Indexed association (not a verified relationship): ' + (record.source_role || 'Not recorded')
    ]);
    assert.equal(await trace.evaluate(el => getComputedStyle(el).whiteSpace), 'pre-line');
    assert.ok(await trace.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth + 1 && el.scrollWidth <= el.clientWidth + 1;
    }), 'source trace must fit the narrow inspector');
    assert.equal(await link.count(), 1);
    assert.equal(await link.evaluate(el => el.href), record.url);
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.ok((await link.getAttribute('rel')).split(/\s+/).includes('noopener'));
    assert.ok((await link.getAttribute('rel')).split(/\s+/).includes('noreferrer'));
    await page.keyboard.press('Escape');
    assert.equal(await card.evaluate(el => el === document.activeElement), true);
  }
  console.log('PASS: native source inspector preserves distinct page URLs and rejects duplicate, credential-bearing, unsafe and unrelated citation fixtures.');

  // Warn before the alternate pointer path opens a separate browsing context.
  assert.match(await page.locator('#card-instructions').innerText(), /Double-click a citation to open its indexed URL in a new tab/);
  const warningIds = (await citation.getAttribute('aria-describedby')).split(/\s+/);
  assert.ok(warningIds.includes('card-instructions'));
  const boardUrlBeforePopup = page.url();
  await page.context().route('https://records.example/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Fixture indexed document</title>' }));
  await page.getByRole('button', { name: 'Fit all cards', exact: true }).click();
  const popupOpened = page.waitForEvent('popup');
  await citation.dblclick();
  const sourcePopup = await popupOpened;
  await sourcePopup.waitForLoadState('domcontentloaded');
  assert.equal(sourcePopup.url(), references[0].url);
  assert.equal(page.url(), boardUrlBeforePopup);
  await sourcePopup.close();
  assert.equal(await citation.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#details h2').textContent(), references[0].title);
  console.log('PASS: persistent card guidance warns of a new tab; double-click opens the exact indexed fixture URL and retains the board.');



  // Narrow the pane while native keyboard focus remains on the citation.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('#reset').click();
  await page.keyboard.press('Tab');
  await citation.focus();
  const beforeResize = await citation.evaluate(el => ({ left: el.style.left, top: el.style.top,
    selected: el.getAttribute('aria-pressed'), zoom: document.getElementById('zoom-level').textContent }));
  await page.setViewportSize({ width: 320, height: 700 });
  await page.waitForFunction(() => {
    const card = document.activeElement, frame = document.getElementById('viewport');
    if (!card.matches('.tile:focus-visible')) return false;
    const bounds = card.getBoundingClientRect(), viewport = frame.getBoundingClientRect();
    return bounds.left >= viewport.left - 1 && bounds.right <= viewport.right + 1;
  });
  assert.deepEqual(await citation.evaluate(el => ({ left: el.style.left, top: el.style.top,
    selected: el.getAttribute('aria-pressed'), zoom: document.getElementById('zoom-level').textContent })), beforeResize);
  console.log('PASS: keyboard-focused citation stays visible after narrowing without changing its layout, selection or zoom.');

  for (const [width, height] of [[320,700], [1280,800]]) {
    await page.setViewportSize({ width, height });
    const positions = await page.locator('.tile').evaluateAll(cards => cards.map(card => [card.style.left, card.style.top, card.getAttribute('aria-pressed')]));
    const inspectorTitle = await page.locator('#details h2').textContent();
    const savedLayout = await page.evaluate(() => localStorage.getItem('atlas-evidence-board-layout-v2-1'));
    await page.getByRole('button', { name: 'Fit all cards', exact: true }).click();
    assert.ok(await page.locator('.tile').evaluateAll(cards => {
      const frame = document.getElementById('viewport').getBoundingClientRect();
      return cards.every(card => { const box = card.getBoundingClientRect(); return box.left >= frame.left + 15 && box.right <= frame.right - 15 && box.top >= frame.top + 15 && box.bottom <= frame.bottom - 15; });
    }), 'every card must fit inside the board with a visible margin');
    assert.deepEqual(await page.locator('.tile').evaluateAll(cards => cards.map(card => [card.style.left, card.style.top, card.getAttribute('aria-pressed')])), positions);
    assert.equal(await page.locator('#details h2').textContent(), inspectorTitle);
    assert.equal(await page.evaluate(() => localStorage.getItem('atlas-evidence-board-layout-v2-1')), savedLayout);
  }
  console.log('PASS: Fit all cards frames every measured card at phone and desktop widths without moving or saving evidence.');

  for (const [width, height] of [[320,700], [768,1024], [1280,800]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
      buttons: [...document.querySelectorAll('#board-controls button')].map(el => {
        const rect = el.getBoundingClientRect(); return { left: rect.left, right: rect.right, height: rect.height };
      }) }));
    const searchSizing = await page.locator('#search').evaluate(el => ({
      font: getComputedStyle(el).fontSize, root: getComputedStyle(document.documentElement).fontSize,
      height: el.getBoundingClientRect().height, left: el.getBoundingClientRect().left,
      right: el.getBoundingClientRect().right
    }));
    assert.equal(searchSizing.font, width <= 650 ? searchSizing.root : '14px');
    if (width <= 650) {
      assert.ok(searchSizing.height >= 44 && searchSizing.left >= 0 && searchSizing.right <= width + 1);
      const currentBoard = await page.locator('.tile').allTextContents();
      await page.locator('#search').fill('No matching phone case');
      assert.equal(await page.locator('#cases button').count(), 0);
      await page.getByRole('button', { name: 'Clear search', exact: true }).click();
      assert.equal(await page.locator('#search').evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator('#cases button').count(), cases.length);
      assert.deepEqual(await page.locator('.tile').allTextContents(), currentBoard);
      const enlargedText = await page.addStyleTag({ content: ':root { font-size: 20px; }' });
      assert.equal(await page.locator('#search').evaluate(el => getComputedStyle(el).fontSize), '20px');
      assert.ok(await page.locator('#search').evaluate(el => el.getBoundingClientRect().right <= innerWidth + 1));
      await enlargedText.evaluate(el => el.remove());
    }
    if (layout.content > layout.width + 1) console.error(await page.locator('body *').evaluateAll(elements => elements.filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, id: el.id, className: String(el.className), right: el.getBoundingClientRect().right })).slice(0, 20)));
    assert.ok(layout.content <= layout.width + 1, `horizontal overflow at ${width}px: ${layout.content}`);
    for (const button of layout.buttons) {
      assert.ok(button.left >= 0 && button.right <= width + 1, `toolbar control outside ${width}px pane`);
      if (width <= 650) assert.ok(button.height >= 44, 'phone control target is under 44px');
    }
  }
  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => { location.hash = '#case=unavailable'; });
  await page.waitForFunction(() => document.getElementById('case-link-status').textContent.includes('unavailable'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true,
    'unavailable-case fallback with a long title must also wrap');
  console.log('PASS: long-title reflow at phone/tablet/desktop widths and phone target sizes.');

  // Exercise actual browser focus and recovery after a failed public-index request.
  await page.goto('https://board.example/evidence-board.html#case=1');
  rejectCaseRequest = true;
  await page.reload();
  const retry = page.locator('#retry-records');
  await retry.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.getElementById('retry-records').getAttribute('aria-disabled') === 'false');
  assert.equal(failedCaseRequests, 1);
  assert.equal(await page.locator('#heading').textContent(), 'Evidence service unavailable');
  assert.match(await page.locator('#case-search-status').textContent(), /could not be loaded/);
  assert.match(await page.locator('#status').textContent(), /No sample evidence has been substituted/);
  assert.equal(await page.locator('.tile').count(), 0);
  assert.equal(await page.locator('#save').isDisabled(), true);
  assert.equal(await page.locator('#search').isDisabled(), true);
  assert.ok(await retry.evaluate(el => el.getBoundingClientRect().height >= 44), 'phone retry touch target');
  rejectCaseRequest = false;
  await retry.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('retry-records').hidden && !document.getElementById('save').disabled);
  assert.equal(await page.locator('#search').evaluate(el => el === document.activeElement), true);
  assert.equal(await page.locator('#heading').textContent(), cases[0].title);
  assert.equal(await page.locator('.tile').count(), 3);
  assert.match(await page.locator('#citation-count').textContent(), /Showing 2 of 2 unique indexed citation URLs/);
  assert.equal(await page.locator('#search').isEnabled(), true);
  assert.equal(failedCaseRequests, 1);
  console.log('PASS: native keyboard retry restores published fixture citations and search focus after an HTTP 503, without sample evidence.');
  // Browse the full fixture index without knowing a title in advance.
  cases.push(...Array.from({ length: 40 }, (_, i) => ({ id: String(i+2), title: 'Case ' + (i+2) })));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#cases button').length === 18);
  const moreCases = page.getByRole('button', { name: 'Show more cases', exact: true });
  const retainedBoard = await page.locator('.tile').allTextContents();
  const originalCaseButtons = await page.locator('#cases button').elementHandles();
  assert.ok(await moreCases.evaluate(el => el.getBoundingClientRect().height >= 44));
  await moreCases.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#cases button').count(), 36);
  for (let i=0; i<originalCaseButtons.length; i++) assert.equal(await page.locator('#cases button').nth(i).evaluate((el, original) => el === original, originalCaseButtons[i]), true);
  const expandedCaseButtons = await page.locator('#cases button').elementHandles();
  assert.equal(await page.locator('#cases button').nth(18).evaluate(el => el === document.activeElement), true);
  await moreCases.click();
  assert.equal(await page.locator('#cases button').count(), 41);
  for (let i=0; i<expandedCaseButtons.length; i++) assert.equal(await page.locator('#cases button').nth(i).evaluate((el, original) => el === original, expandedCaseButtons[i]), true);
  assert.equal(await page.locator('#cases button').nth(36).evaluate(el => el === document.activeElement), true);
  assert.equal(await moreCases.isVisible(), false);
  assert.deepEqual(await page.locator('.tile').allTextContents(), retainedBoard);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#heading').textContent(), 'Case 37');
  assert.equal(await page.locator('#cases button[aria-pressed="true"]').count(), 1);
  await page.locator('#search').fill('Case');
  assert.equal(await page.locator('#cases button').count(), 18);
  assert.equal(await moreCases.isVisible(), true);
  await page.locator('#search').fill('No matching case');
  assert.equal(await moreCases.isVisible(), false);
  console.log('PASS: keyboard Show more retains existing case-button identity through 18/36/41 cases, focuses each new batch, preserves the board and resets on filtering.');
  await page.locator('#search').fill('Case');
  await moreCases.click();
  await moreCases.click();
  const caseRegion = page.getByRole('region', { name: 'Matching published cases', exact: true });
  assert.equal(await caseRegion.count(), 1);
  const bounded = await caseRegion.evaluate(el => ({ height: el.getBoundingClientRect().height,
    maximum: innerHeight * .55, client: el.clientHeight, content: el.scrollHeight }));
  assert.ok(bounded.height <= bounded.maximum + 1 && bounded.content > bounded.client,
    'phone case list is a bounded scroll area');
  await page.getByRole('link', { name: 'Board controls ↓', exact: true }).focus();
  await page.keyboard.press('Tab');
  assert.equal(await caseRegion.evaluate(el => el === document.activeElement), true);
  assert.equal(await caseRegion.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.getElementById('cases').scrollTop > 0);
  const lastCase = page.locator('#cases button').last();
  await lastCase.focus();
  await page.waitForFunction(() => {
    const list=document.getElementById('cases'), item=list.lastElementChild;
    const frame=list.getBoundingClientRect(), bounds=item.getBoundingClientRect();
    return document.activeElement===item && bounds.top >= frame.top && bounds.bottom <= frame.bottom;
  });
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('#zin').evaluate(el => el===document.activeElement), true, 'Tab leaves the case list');
  const boardBeforeQueryReset = await page.locator('.tile').allTextContents();
  await page.locator('#search').fill('Case ');
  await page.waitForFunction(() => document.getElementById('cases').scrollTop === 0);
  assert.equal(await page.locator('#search').evaluate(el => el===document.activeElement), true);
  assert.ok(await page.locator('#cases button').first().evaluate(el => {
    const bounds=el.getBoundingClientRect(), frame=document.getElementById('cases').getBoundingClientRect();
    return bounds.top>=frame.top && bounds.bottom<=frame.bottom;
  }));
  await caseRegion.focus();
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.getElementById('cases').scrollTop > 0);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('cases').scrollTop === 0);
  assert.equal(await page.locator('#search').evaluate(el => el===document.activeElement), true);
  assert.deepEqual(await page.locator('.tile').allTextContents(), boardBeforeQueryReset);
  console.log('PASS: changed query and Clear return phone results to the top, retain input focus and preserve the open board.');
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.equal(await caseRegion.evaluate(el => getComputedStyle(el).overflowY), 'visible');
  assert.equal(await caseRegion.evaluate(el => getComputedStyle(el).maxHeight), 'none');
  console.log('PASS: named phone case list has bounded height, keyboard scrolling, visible final-result focus and a Tab exit; desktop remains unbounded.');
  assert.deepEqual(errors, [], 'no uncaught frontend exceptions');
  assert.deepEqual(unexpected, [], 'all requests use fixtures; no production data or outgoing source requests');
  console.log('PASS: no uncaught page errors or unexpected requests.');
} finally {
  await browser.close();
}
