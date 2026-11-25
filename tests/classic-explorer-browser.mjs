import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.EVIDENCE_BOARD_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.EVIDENCE_BOARD_PLAYWRIGHT_MODULE).href:'playwright');
const original=await readFile(new URL('../connection-explorer.html',import.meta.url),'utf8');
const cases=[{id:1,title:'Fixture investigation',summary:'Public fixture summary'}];
const references=[{case_id:1,title:'Fixture source A',publisher:'Fixture archive',url:'https://records.example/a'},
  {case_id:1,title:'Fixture source B',publisher:'Fixture archive',url:'https://records.example/b'}];
const browser=await chromium.launch();
try {
  // Run the actual page twice: reproduce the old img semantics, then verify the group fix.
  for(const baseline of [true,false]) {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[],unexpected=[];
    page.on('pageerror',e=>errors.push(e.message));
    const html=baseline?original.replace('id="graph" class="graph" role="group"','id="graph" class="graph" role="img"'):original;
    await page.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.origin==='https://classic.example'&&u.pathname==='/connection-explorer.html')return route.fulfill({contentType:'text/html',body:html});
      if(u.origin==='https://classic.example'&&u.pathname==='/paper-trails-data.json')return route.fulfill({json:{references}});
      if(u.hostname==='nxlffnplqdobfqxogmxo.supabase.co'&&u.pathname==='/functions/v1/evidence-atlas/api/cases')return route.fulfill({json:cases,headers:{'access-control-allow-origin':'*'}});
      if(u.pathname==='/favicon.ico')return route.fulfill({status:204});
      unexpected.push(u.href);return route.abort();
    });
    await page.goto('https://classic.example/connection-explorer.html#case=1');
    await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
    const cdp=await page.context().newCDPSession(page);
    const {nodes}=await cdp.send('Accessibility.getFullAXTree');
    const exposed=nodes.filter(n=>!n.ignored&&n.role?.value==='button').map(n=>n.name?.value);
    for(const name of [cases[0].title,...references.map(r=>r.title)])
      assert.equal(exposed.includes(name),!baseline, name+' native accessibility-tree exposure');
    if(baseline) {
      console.log('PASS: previous img role reproduces hidden case/source buttons in Chromium accessibility tree.');
    } else {
      assert.ok(nodes.some(n=>!n.ignored&&n.role?.value==='group'&&n.name?.value==='Interactive case and source connection diagram'));
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        await page.locator('#resetView').focus();
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#graph .node').nth(0).evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#graph .node').nth(1).evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#detail h2').textContent(),'Fixture source A');
        assert.equal(await page.locator('#detail a').getAttribute('href'),'https://records.example/a');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Space');
        assert.equal(await page.locator('#detail h2').textContent(),'Fixture source B');
        assert.equal(await page.locator('#detail a').getAttribute('href'),'https://records.example/b');
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#detail a').evaluate(el=>el===document.activeElement),true,'Tab leaves diagram for inspected source link');
        assert.equal(await page.locator('#graph .node').count(),3);
      }
      console.log('PASS: named group exposes all case/source buttons; native Tab, Enter/Space inspection and Tab exit work at 320/768/1280px.');
    }
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
    await page.close();
  }
  console.log('PASS: no uncaught page errors or requests outside intercepted public fixtures.');
} finally {await browser.close();}
