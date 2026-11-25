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
  // Compare the static-image wrapper with the named interactive group using native AX data.
  for(const baseline of [true,false]) {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[],unexpected=[];
    page.on('pageerror',e=>errors.push(e.message));
    const html=baseline?original.replace('id="graph" class="graph" role="group"','id="graph" class="graph" role="img"').replace('hidden style="margin-top:15px;gap:12px"','hidden style="margin-top:15px;display:grid;gap:12px"'):original;
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
      assert.equal(exposed.includes(name),true, name+' native accessibility-tree exposure');
    if(baseline) {
      assert.ok(nodes.some(n=>!n.ignored&&n.role?.value==='image'&&n.name?.value==='Interactive case and source connection diagram'));
      assert.equal(await page.locator('#draftForm').evaluate(el=>el.hidden),true);
      assert.equal(await page.locator('#draftForm').isVisible(),true,'old inline display:grid overrides hidden');
      console.log('PASS: old inline grid reproduces a visible draft form despite its hidden attribute.');
      console.log('PASS: baseline reproduces image wrapper; Chromium retains focusable card buttons despite the image role.');
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
        assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#detail h2').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#detail a').evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#graph .node').nth(1).evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#detail a').getAttribute('href'),'https://records.example/a');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Space');
        assert.equal(await page.locator('#detail h2').textContent(),'Fixture source B');
        assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#detail a').getAttribute('href'),'https://records.example/b');
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#detail a').evaluate(el=>el===document.activeElement),true,'Tab leaves diagram for inspected source link');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#graph .node').nth(2).evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#detail a').evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#graph .node').count(),3);
      }
      assert.equal(await page.locator('#draftForm').isVisible(),false,'draft form starts hidden');
      assert.equal(await page.getByRole('textbox',{name:'Title',exact:true}).count(),0,'closed form is outside accessible controls');
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const [trigger,title,required] of [['newCase','New case draft',false],['newTrail','New paper trail draft',true]]) {
          await page.locator('#'+trigger).focus();await page.keyboard.press('Enter');
          assert.equal(await page.locator('#draftForm').isVisible(),true);
          assert.equal(await page.locator('#draftForm').evaluate(el=>getComputedStyle(el).display),'grid');
          assert.equal(await page.locator('#formHeading').textContent(),title);
          assert.equal(await page.locator('#draftTitle').evaluate(el=>el===document.activeElement),true);
          assert.equal(await page.locator('#draftUrl').evaluate(el=>el.required),required);
          await page.locator('#draftTitle').fill('Unsaved fixture');
          await page.locator('#cancelDraft').focus();await page.keyboard.press('Enter');
          assert.equal(await page.locator('#draftForm').isVisible(),false);
          assert.equal(await page.getByRole('textbox',{name:'Title',exact:true}).count(),0);
          assert.equal(await page.locator('#'+trigger).evaluate(el=>el===document.activeElement),true);
          assert.equal(await page.evaluate(()=>localStorage.length),0,'Cancel does not save a draft');
        }
      }
      await page.locator('#newCase').click();
      assert.equal(await page.locator('#draftTitle').inputValue(),'Unsaved fixture','Cancel preserves unsubmitted text');
      await page.getByRole('button',{name:'Save private draft',exact:true}).click();
      assert.equal(await page.locator('#draftForm').isVisible(),false);
      assert.equal(await page.locator('#newCase').evaluate(el=>el===document.activeElement),true);
      assert.match(await page.locator('#draftStatus').textContent(),/saved in this browser only/);
      assert.match(await page.locator('#draftList').textContent(),/Unsaved fixture/);
      assert.equal(await page.evaluate(()=>localStorage.length),1);
      await page.locator('#newTrail').click();
      assert.equal(await page.locator('#draftTitle').inputValue(),'');
      await page.locator('#cancelDraft').click();
      console.log('PASS: draft form starts outside layout/accessibility controls; case/trail opening, keyboard Cancel and focus return work at 320/768/1280px without saving; fixture-only successful Save closes and resets the form.');
      await page.locator('#search').focus();
      await page.locator('#graph .node').nth(1).click();
      assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),false,'pointer inspection does not focus heading');
      const prior=await page.locator('#detail h2').textContent();
      await page.locator('#graph .node').nth(2).focus();
      await page.keyboard.press('Control+Enter');
      assert.equal(await page.locator('#detail h2').textContent(),prior,'modified activation is untouched');
      await page.locator('#graph .node').nth(0).focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.locator('#detail h2').textContent(),cases[0].title);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#graph .node').nth(0).evaluate(el=>el===document.activeElement),true);
      console.log('PASS: keyboard inspection focuses visible details heading, Tab reaches source link, Escape returns to originating case/source, pointer focus and modified keys remain unchanged.');
      console.log('PASS: named group exposes all case/source buttons; native Tab, Enter/Space inspection and Tab exit work at 320/768/1280px.');
    }
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
    await page.close();
  }
  console.log('PASS: no uncaught page errors or requests outside intercepted public fixtures.');
} finally {await browser.close();}
