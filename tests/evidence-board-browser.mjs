import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// CI installs this pinned test-only dependency outside the repository.
const { chromium } = await import(process.env.EVIDENCE_BOARD_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.EVIDENCE_BOARD_PLAYWRIGHT_MODULE).href : 'playwright');
const html = await readFile(new URL('../evidence-board.html', import.meta.url), 'utf8');
const cases = [{ id: '1', title: 'Investigation ' + 'UnbrokenTitle'.repeat(25) }];
const references = [{ case_id: '1', title: 'Browser fixture citation', url: 'https://records.example/document' }];
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

  for (const [width, height] of [[320,700], [768,1024], [1280,800]]) {
    await page.setViewportSize({ width, height });
    const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth,
      buttons: [...document.querySelectorAll('#board-controls button')].map(el => {
        const rect = el.getBoundingClientRect(); return { left: rect.left, right: rect.right, height: rect.height };
      }) }));
    assert.ok(layout.content <= layout.width + 1, `horizontal overflow at ${width}px: ${layout.content}`);
    for (const button of layout.buttons) {
      assert.ok(button.left >= 0 && button.right <= width + 1, `toolbar control outside ${width}px pane`);
      if (width <= 650) assert.ok(button.height >= 44, 'phone control target is under 44px');
    }
  }
  assert.deepEqual(errors, [], 'no uncaught frontend exceptions');
  assert.deepEqual(unexpected, [], 'all requests use fixtures; no production data or outgoing source requests');
  console.log('PASS: long-title reflow at phone/tablet/desktop widths with phone target sizes and no page errors.');
} finally {
  await browser.close();
}
