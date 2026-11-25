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
    let pauseCases=false,releaseCases,casesPaused,rejectCases=false;
    page.on('pageerror',e=>errors.push(e.message));
    const html=baseline?original.replace('id="graph" class="graph" role="group"','id="graph" class="graph" role="img"').replace('hidden style="margin-top:15px;gap:12px"','hidden style="margin-top:15px;display:grid;gap:12px"'):original;
    await page.route('**/*',async route=>{
      const u=new URL(route.request().url());
      if(u.origin==='https://classic.example'&&u.pathname==='/connection-explorer.html')return route.fulfill({contentType:'text/html',body:html});
      if(u.origin==='https://classic.example'&&u.pathname==='/paper-trails-data.json')return route.fulfill({json:{references}});
      if(u.hostname==='nxlffnplqdobfqxogmxo.supabase.co'&&u.pathname==='/functions/v1/evidence-atlas/api/cases'){
        if(pauseCases)await new Promise(resolve=>{releaseCases=resolve;casesPaused()});
        if(rejectCases)return route.fulfill({status:503,json:{error:'Fixture service unavailable'},headers:{'access-control-allow-origin':'*'}});
        return route.fulfill({json:cases,headers:{'access-control-allow-origin':'*'}});
      }
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
      const destination='https://records.example/long?record='+ 'x'.repeat(300)+'&id=42#page=7';
      const unsafe=[{title:'Script citation',url:'javascript:alert(1)'},
        {title:'Credential citation',url:'https://user:password@records.example/private'},
        {title:'File citation',url:'file:///fixture'}];
      references.push({case_id:1,title:'Exact destination citation',url:destination},...unsafe.map(r=>({case_id:1,...r})));
      await page.reload();
      await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===7);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        await page.locator('#graph .node').nth(3).focus();await page.keyboard.press('Enter');
        assert.equal(await page.locator('#detail .indexed-url').textContent(),'Indexed URL: '+destination);
        assert.equal(await page.locator('#detail a').getAttribute('href'),destination);
        assert.match(await page.locator('#detail a').textContent(),/records.example.*opens in new tab/);
        assert.equal(await page.locator('#detail a').getAttribute('target'),'_blank');
        assert.equal(await page.locator('#detail a').getAttribute('rel'),'noopener noreferrer');
        assert.ok(await page.locator('#detail .indexed-url').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth));
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#detail a').evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Escape');
      }
      for(let i=4;i<7;i++) {
        await page.locator('#graph .node').nth(i).focus();await page.keyboard.press('Enter');
        assert.equal(await page.locator('#detail a').count(),0);
        assert.equal(await page.locator('#detail .indexed-url').count(),0);
        assert.match(await page.locator('#detail').textContent(),/No safe HTTP\(S\) destination/);
        assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#graph .node').nth(i).evaluate(el=>el===document.activeElement),true);
      }
      await page.locator('#graph .node').first().press('Enter');
      assert.equal(await page.locator('#detail .indexed-url').count(),0,'case card has no invented citation URL');
      console.log('PASS: full indexed destination preserves long query/fragment, wraps at 320/768/1280px and labels host/new tab; script/file/credential citations render no link and retain keyboard return.');
      cases.push({id:2,title:'Related fixture investigation',summary:'Second fixture summary'});
      references.push({case_id:2,title:'Shared fixture citation',url:references[0].url});
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        await page.goto('https://classic.example/connection-explorer.html#case=1');
        await page.reload();
        await page.waitForFunction(()=>document.querySelector('#graph .node')?.getAttribute('aria-label')==='Fixture investigation');
        const oldSource=await page.locator('#graph .node').nth(1).elementHandle();
        await page.locator('#graph .node').nth(1).press('Enter');
        await page.keyboard.press('Tab');await page.keyboard.press('Tab');
        const related=page.getByRole('button',{name:'Related fixture investigation',exact:true});
        assert.equal(await related.evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Enter');
        assert.equal(new URL(page.url()).hash,'#case=2');
        assert.equal(await oldSource.evaluate(el=>el.isConnected),false,'old graph card was replaced');
        assert.equal(await page.locator('#detail h2').textContent(),'Related fixture investigation');
        assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#detail h2').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#graph .node').first().evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#graph .node').first().getAttribute('aria-label'),'Related fixture investigation');
        await page.keyboard.press('Enter');await page.keyboard.press('Tab');
        assert.equal(await page.locator('#newCase').evaluate(el=>el===document.activeElement),true,'Tab can leave current-case details');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#newCase').evaluate(el=>el===document.activeElement),true,'Escape outside inspector is untouched');
      }
      console.log('PASS: shared-citation case navigation focuses the new investigation heading, Escape reaches its live case card, and Tab leaves details at 320/768/1280px without returning to removed cards.');
      pauseCases=true;
      const paused=new Promise(resolve=>casesPaused=resolve);
      await page.reload();await paused;
      assert.equal(await page.locator('#search').isDisabled(),true,'loading search cannot report a false no-match');
      assert.equal(await page.locator('#search-status').textContent(),'Loading published case search…');
      assert.equal(await page.locator('#results button').count(),0);
      pauseCases=false;releaseCases();
      await page.waitForFunction(()=>!document.querySelector('#search').disabled);
      assert.equal(await page.locator('#search-status').textContent(),'Type a title to search 2 published cases.');
      cases.push(...Array.from({length:20},(_,i)=>({id:i+3,title:'SearchMatch '+(i+1)})));
      await page.reload();await page.waitForFunction(()=>!document.querySelector('#search').disabled);
      assert.equal(await page.locator('#search').getAttribute('aria-describedby'),'search-status');
      assert.equal(await page.locator('#search-status').getAttribute('role'),'status');
      assert.equal(await page.locator('#search-status').getAttribute('aria-atomic'),'true');
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        const caseTitle=await page.locator('#detail h2').textContent(),caseHash=new URL(page.url()).hash;
        await page.locator('#search').fill('SearchMatch');
        assert.equal(await page.locator('#results button').count(),15);
        assert.equal(await page.locator('#search-status').textContent(),'15 of 20 matching published cases shown. Refine your search to find other cases.');
        assert.equal(await page.locator('#search').evaluate(el=>el===document.activeElement),true);
        assert.ok(await page.locator('#search-status').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth));
        await page.locator('#search').fill('NoMatchingFixture');
        assert.equal(await page.locator('#results button').count(),0);
        assert.equal(await page.locator('#search-status').textContent(),'No matching published cases. Try another title.');
        await page.locator('#search').fill('');
        assert.equal(await page.locator('#results button').count(),0);
        assert.equal(await page.locator('#search-status').textContent(),'Type a title to search 22 published cases.');
        assert.equal(await page.locator('#search').evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#detail h2').textContent(),caseTitle);
        assert.equal(new URL(page.url()).hash,caseHash,'query updates do not navigate');
      }
      await page.locator('#search').fill('SearchMatch 20');
      assert.equal(await page.locator('#search-status').textContent(),'1 matching published case.');
      await page.locator('#results button').press('Enter');
      assert.equal(new URL(page.url()).hash,'#case=22');
      assert.equal(await page.locator('#search-status').textContent(),'Opened investigation: SearchMatch 20. Search again to find another case.');
      assert.equal(await page.locator('#results button').count(),0);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const key of ['Enter','Space']) {
          await page.locator('#search').fill('SearchMatch 20');
          await page.locator('#search').press('Tab');
          const result=page.locator('#results button');
          assert.equal(await result.evaluate(el=>el===document.activeElement),true);
          const removed=await result.elementHandle();
          await page.keyboard.press(key);
          assert.equal(await removed.evaluate(el=>el.isConnected),false);
          assert.equal(new URL(page.url()).hash,'#case=22');
          assert.equal(await page.locator('#detail h2').textContent(),'SearchMatch 20');
          assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
          assert.equal(await page.locator('#detail h2').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
          assert.ok(await page.locator('#detail h2').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),'focused details scroll into view');
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#graph .node').first().evaluate(el=>el===document.activeElement),true);
          await page.keyboard.press('Enter');await page.keyboard.press('Tab');
          assert.equal(await page.locator('#newCase').evaluate(el=>el===document.activeElement),true,'Tab leaves selected-case details');
        }
        await page.locator('#search').fill('Fixture investigation');
        await page.locator('#results button').first().click();
        assert.equal(await page.locator('#detail h2').textContent(),'Fixture investigation');
        assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true,'pointer selection also avoids removed-control focus');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#graph .node').first().evaluate(el=>el===document.activeElement),true);
      }
      console.log('PASS: search-result Enter/Space and pointer selection focus the opened investigation heading; removed result is detached, heading is visible with keyboard outline, Escape reaches the live case card and Tab can leave details at 320/768/1280px.');
      rejectCases=true;await page.reload();
      await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('unavailable'));
      assert.equal(await page.locator('#search').isDisabled(),true);
      assert.equal(await page.locator('#search-status').textContent(),'Published case search is unavailable. Please retry later.');
      assert.equal(await page.locator('#results button').count(),0);
      assert.equal(await page.locator('#graph .node').count(),0,'failure does not fabricate records');
      assert.match(await page.locator('#status').textContent(),/Could not load the public investigation data/);
      rejectCases=false;cases.splice(0);await page.reload();
      await page.waitForFunction(()=>!document.querySelector('#search').disabled);
      assert.equal(await page.locator('#search-status').textContent(),'No published cases available.');
      assert.equal(await page.locator('#results button').count(),0);
      console.log('PASS: loading, unavailable and empty published-data states stay distinct; search counts, 15-of-20 truncation, no-match and selected-case feedback work at 320/768/1280px without query updates stealing focus or changing the case.');
      console.log('PASS: named group exposes all case/source buttons; native Tab, Enter/Space inspection and Tab exit work at 320/768/1280px.');
    }
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
    await page.close();
  }
  console.log('PASS: no uncaught page errors or requests outside intercepted public fixtures.');
} finally {await browser.close();}
