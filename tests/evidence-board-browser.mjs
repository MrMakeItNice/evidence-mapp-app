import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// CI installs this pinned test-only dependency outside the repository.
const { chromium } = await import(process.env.EVIDENCE_BOARD_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.EVIDENCE_BOARD_PLAYWRIGHT_MODULE).href : 'playwright');
const html = await readFile(new URL('../evidence-board.html', import.meta.url), 'utf8');
const cases = [{ id: '1', title: 'Investigation ' + 'UnbrokenTitle'.repeat(25) }];
const references = [
  { case_id: '1', title: 'Browser fixture citation', url: 'https://records.example/document?id=42#page=2' },
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
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://board.example' && url.pathname === '/evidence-board.html')
      return route.fulfill({ contentType: 'text/html', body: html });
    if (url.origin === 'https://board.example' && url.pathname === '/paper-trails-data.json')
      return route.fulfill({ json: { references } });
    if (url.hostname === 'nxlffnplqdobfqxogmxo.supabase.co' && url.pathname === '/functions/v1/evidence-atlas/api/cases')
      return route.fulfill({ json: cases, headers: { 'access-control-allow-origin': '*' } });
    if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204 });
    unexpected.push(route.request().url());
    return route.abort();
  });
  await page.goto('https://board.example/evidence-board.html#case=1');
  await page.waitForFunction(() => !document.getElementById('save').disabled);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip-board').evaluate(el => el === document.activeElement), true);
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
    assert.equal(await link.count(), 1);
    assert.equal(await link.evaluate(el => el.href), record.url);
    assert.equal(await link.getAttribute('target'), '_blank');
    assert.ok((await link.getAttribute('rel')).split(/\s+/).includes('noopener'));
    assert.ok((await link.getAttribute('rel')).split(/\s+/).includes('noreferrer'));
    await page.keyboard.press('Escape');
    assert.equal(await card.evaluate(el => el === document.activeElement), true);
  }
  console.log('PASS: native source inspector preserves distinct page URLs and rejects duplicate, credential-bearing, unsafe and unrelated citation fixtures.');


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

  for (const [width, height] of [[320,700], [768,1024], [1280,800]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
      buttons: [...document.querySelectorAll('#board-controls button')].map(el => {
        const rect = el.getBoundingClientRect(); return { left: rect.left, right: rect.right, height: rect.height };
      }) }));
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
  assert.deepEqual(errors, [], 'no uncaught frontend exceptions');
  assert.deepEqual(unexpected, [], 'all requests use fixtures; no production data or outgoing source requests');
  console.log('PASS: long-title reflow at phone/tablet/desktop widths with phone target sizes and no page errors.');
} finally {
  await browser.close();
}
