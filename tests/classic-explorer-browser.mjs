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
    let pauseRefs=false,releaseRefs,refsPaused,pauseCases=false,releaseCases,casesPaused,rejectCases=false,caseRequests=0,unwrappedDetails=false,ignoreHashNavigation=false;
    page.on('pageerror',e=>errors.push(e.message));
    const html=baseline?original.replace('id="graph" class="graph" role="group"','id="graph" class="graph" role="img"').replace('<search aria-label="Published investigations">','<div>').replace('</search>','</div>').replace('hidden style="margin-top:15px;gap:12px"','hidden style="margin-top:15px;display:grid;gap:12px"'):original;
    await page.route('**/*',async route=>{
      const u=new URL(route.request().url());
      if(u.origin==='https://classic.example'&&u.pathname==='/connection-explorer.html')return route.fulfill({contentType:'text/html',body:ignoreHashNavigation?html.replace("window.addEventListener('hashchange',navigateFromHash);",''):unwrappedDetails?html.replace('.detail,#search-status{min-width:0;overflow-wrap:anywhere}',''):html});
      if(u.origin==='https://classic.example'&&['/discover.html','/paper-trails.html','/evidence-board.html'].includes(u.pathname))return route.fulfill({contentType:'text/html',body:'<h1>Navigation destination fixture</h1>'});
      if(u.origin==='https://classic.example'&&u.pathname==='/paper-trails-data.json'){if(pauseRefs)await new Promise(resolve=>{releaseRefs=resolve;refsPaused()});if(route.request().failure())return;return route.fulfill({json:{references}})}
      if(u.hostname==='nxlffnplqdobfqxogmxo.supabase.co'&&u.pathname==='/functions/v1/evidence-atlas/api/cases'){
        caseRequests++;
        if(pauseCases)await new Promise(resolve=>{releaseCases=resolve;casesPaused()});
        if(route.request().failure())return;
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
      assert.equal(nodes.some(n=>!n.ignored&&n.role?.value==='search'),false,'baseline search input alone is not a search landmark');
      console.log('PASS: baseline has a search field but no native search landmark.');
      assert.ok(nodes.some(n=>!n.ignored&&n.role?.value==='image'&&n.name?.value==='Interactive case and source connection diagram'));
      assert.equal(await page.locator('#draftForm').evaluate(el=>el.hidden),true);
      assert.equal(await page.locator('#draftForm').isVisible(),true,'old inline display:grid overrides hidden');
      console.log('PASS: old inline grid reproduces a visible draft form despite its hidden attribute.');
      console.log('PASS: baseline reproduces image wrapper; Chromium retains focusable card buttons despite the image role.');
    } else {
      assert.ok(nodes.some(n=>!n.ignored&&n.role?.value==='search'&&n.name?.value==='Published investigations'),'native accessibility tree exposes the named search landmark');
      const nav=page.getByRole('navigation',{name:'Explorer navigation',exact:true});
      const navLabels=['Home','Paper Trails','New Evidence Board'],navPaths=['/discover.html','/paper-trails.html','/evidence-board.html'];
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await nav.getByRole('link').count(),3);
        const boxes=await nav.getByRole('link').evaluateAll(es=>es.map(e=>({text:e.textContent,href:e.getAttribute('href'),...e.getBoundingClientRect().toJSON()})));
        for(let i=0;i<3;i++) {
          assert.equal(boxes[i].text,navLabels[i]);assert.equal(boxes[i].href,'.'+navPaths[i]);
          assert.ok(boxes[i].width>=44&&boxes[i].height>=44,'header links have at least 44px targets');
          assert.ok(boxes[i].left>=0&&boxes[i].right<=width,'header targets stay within viewport');
          for(let j=0;j<i;j++)assert.ok(boxes[i].left>=boxes[j].right||boxes[i].right<=boxes[j].left||boxes[i].top>=boxes[j].bottom||boxes[i].bottom<=boxes[j].top,'header targets do not overlap');
        }
        assert.ok(await page.locator('header').evaluate(el=>el.scrollWidth<=el.clientWidth),'header wraps without horizontal overflow');
        await nav.getByRole('link',{name:'Home',exact:true}).focus();
        for(let i=0;i<3;i++) {
          if(i)await page.keyboard.press('Tab');
          assert.equal(await nav.getByRole('link',{name:navLabels[i],exact:true}).evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')&&parseFloat(getComputedStyle(el).outlineWidth)>=3),true,'native keyboard order retains visible focus');
        }
        await page.keyboard.press('Shift+Tab');assert.equal(await nav.getByRole('link',{name:'Paper Trails',exact:true}).evaluate(el=>el===document.activeElement),true);
      }
      for(let i=0;i<3;i++) {
        await nav.getByRole('link',{name:navLabels[i],exact:true}).press('Enter');
        await page.waitForURL('https://classic.example'+navPaths[i]);
        assert.equal(await page.locator('h1').textContent(),'Navigation destination fixture');
        await page.goto('https://classic.example/connection-explorer.html#case=1');
        await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      }
      await page.setViewportSize({width:320,height:900});
      await nav.getByRole('link',{name:'New Evidence Board',exact:true}).click();
      await page.waitForURL('https://classic.example/evidence-board.html');
      await page.goto('https://classic.example/connection-explorer.html#case=1');
      await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      console.log('PASS: named Classic header navigation has non-overlapping 44px targets and visible native Tab/Shift+Tab order at 320/768/1280px; Enter reaches all three existing destinations and phone pointer click reaches the board fixture.');
      const searchRegion=page.getByRole('search',{name:'Published investigations',exact:true});
      assert.equal(await page.getByRole('search').count(),1,'one focused search landmark, not a landmark for every control');
      assert.equal(await searchRegion.evaluate(el=>el.tagName),'SEARCH');
      assert.equal(await searchRegion.getAttribute('tabindex'),null,'landmark adds no artificial keyboard stop');
      assert.equal(await searchRegion.locator('#searchHelp').count(),1);
      assert.equal(await searchRegion.locator('#search-status').count(),1);
      assert.equal(await searchRegion.locator('#retryLoad').count(),1);
      assert.equal(await searchRegion.locator('#results').count(),1,'quick investigation navigation stays with search');
      assert.equal(await searchRegion.locator('#graph').count(),0,'evidence diagram remains main content outside search');
      assert.equal(await searchRegion.locator('#draftForm').count(),0,'private draft editor is not part of public search');
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        const hash=new URL(page.url()).hash,cards=await page.locator('#graph').innerHTML(),view=await page.locator('#graph').getAttribute('viewBox');
        const field=searchRegion.getByRole('searchbox',{name:'Find an investigation',exact:true});
        await field.fill('No matching landmark fixture');
        assert.equal(await searchRegion.locator('#results button').count(),0);
        assert.equal(await searchRegion.getByRole('status').textContent(),'No matching published cases. Try another title or case ID.');
        await field.press('Enter');
        assert.equal(new URL(page.url()).hash,hash,'Enter in the search field does not submit or navigate');
        assert.equal(await field.evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#graph').innerHTML(),cards);assert.equal(await page.locator('#graph').getAttribute('viewBox'),view);
        await field.fill('Fixture investigation');
        assert.equal(await searchRegion.getByRole('button',{name:'Fixture investigation · Case #1',exact:true}).count(),1);
        await field.fill('');
        assert.equal(await searchRegion.locator('#results button').count(),0);
        assert.ok(await searchRegion.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),'landmark preserves page reflow');
      }
      console.log('PASS: native AX exposes the single Published investigations search landmark with field/instructions/status/retry/quick suggestions, excluding diagram/private editor; no new Tab stop, filtering/Enter retain focus and case/zoom/cards at 320/768/1280px.');
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        await page.locator('#newCase').click();await page.locator('#draftTitle').fill('Unfinished clear-search fixture');
        const cards=await page.locator('#graph').innerHTML(),view=await page.locator('#graph').getAttribute('viewBox'),hash=new URL(page.url()).hash,heading=await page.locator('#detail h2').textContent(),requests=caseRequests,stored=await page.evaluate(()=>localStorage.getItem('evidence-atlas-connection-drafts-v1'));
        const field=page.getByRole('searchbox',{name:'Find an investigation',exact:true}),clear=page.getByRole('button',{name:'Clear search',exact:true});
        assert.equal(await clear.isVisible(),false);
        for(const [query,key] of [['Fixture','Enter'],['No matching clear fixture','Space'],['   ','Enter']]) {
          await field.fill(query);assert.equal(await clear.isVisible(),true);
          assert.equal(await page.getByRole('search',{name:'Published investigations'}).getByRole('button',{name:'Clear search',exact:true}).count(),1);
          const count=await page.locator('#results button').count();
          await field.press('Tab');for(let i=0;i<count;i++)await page.keyboard.press('Tab');
          assert.equal(await clear.evaluate(el=>el===document.activeElement),true,'Clear follows suggestions in native Tab order');
          assert.ok(await clear.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.right<=innerWidth}));
          await page.keyboard.press(key);
          assert.equal(await field.inputValue(),'');assert.equal(await field.evaluate(el=>el===document.activeElement),true);
          assert.equal(await clear.isVisible(),false);assert.equal(await page.locator('#results button').count(),0);
          assert.match(await page.locator('#search-status').textContent(),/^Type a title or case ID to search/);
          assert.equal(await page.locator('#graph').innerHTML(),cards);assert.equal(await page.locator('#graph').getAttribute('viewBox'),view);assert.equal(new URL(page.url()).hash,hash);assert.equal(await page.locator('#detail h2').textContent(),heading);
          assert.equal(await page.locator('#draftTitle').inputValue(),'Unfinished clear-search fixture');assert.equal(await page.locator('#draftForm').isVisible(),true);assert.equal(caseRequests,requests);assert.equal(await page.evaluate(()=>localStorage.getItem('evidence-atlas-connection-drafts-v1')),stored);
        }
        await field.fill('Fixture');assert.equal(await page.locator('#results button').count(),1,'filtering works again after clearing');await field.fill('');
        await page.locator('#draftTitle').fill('');await page.locator('#cancelDraft').click();
      }
      console.log('PASS: named Clear search follows suggestions, supports native Enter/Space at 320/768/1280px, clears matches/no-match/whitespace and returns input focus without changing investigation/view/evidence/private form/storage or refetching.');
      assert.equal(await page.locator('#search').getAttribute('aria-keyshortcuts'),'Control+K Meta+K');
      for(const width of [320,768,1280])for(const modifier of ['Control','Meta']) {
        await page.setViewportSize({width,height:900});await page.locator('#search').fill('Fixture');
        const card=page.locator('#graph .node').first(),source=page.locator('#graph .node').nth(1);
        const cards=await page.locator('#graph').innerHTML(),view=await page.locator('#graph').getAttribute('viewBox'),hash=new URL(page.url()).hash,requests=caseRequests;
        for(const origin of ['card','heading','sourceLink']) {
          if(origin==='card')await card.focus();
          else if(origin==='heading')await card.press('Enter');
          else{await source.press('Enter');await page.keyboard.press('Tab');assert.equal(await page.locator('#detail a').evaluate(el=>el===document.activeElement),true)}
          await page.keyboard.press(modifier+'+k');
          const shortcutState=await page.locator('#search').evaluate(el=>({focused:el===document.activeElement,start:el.selectionStart,end:el.selectionEnd,length:el.value.length,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,height:innerHeight}));
          assert.ok(shortcutState.focused&&shortcutState.start===0&&shortcutState.end===shortcutState.length&&shortcutState.top>=0&&shortcutState.bottom<=shortcutState.height,'shortcut state '+JSON.stringify({width,modifier,origin,...shortcutState}));
          assert.equal(await page.locator('#search').inputValue(),'Fixture');assert.equal(await page.locator('#results button').count(),1);
          assert.equal(await page.locator('#graph').innerHTML(),cards);assert.equal(await page.locator('#graph').getAttribute('viewBox'),view);assert.equal(new URL(page.url()).hash,hash);assert.equal(caseRequests,requests);
        }
        await page.keyboard.type('No shortcut match');assert.equal(await page.locator('#search').inputValue(),'No shortcut match','typing replaces selected query');assert.equal(await page.locator('#results button').count(),0);
        await page.locator('#search').fill('');
      }
      const guardResults=await page.evaluate(()=>{
        const graph=document.querySelector('#graph'),detail=document.querySelector('#detail'),editor=document.createElement('div');editor.contentEditable='true';detail.append(editor);
        const send=(el,options)=>{const event=new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true,...options});el.dispatchEvent(event);return event.defaultPrevented};
        const results=[send(document.querySelector('#draftTitle')),send(editor),send(graph,{isComposing:true}),send(graph,{shiftKey:true}),send(graph,{altKey:true}),send(graph,{ctrlKey:false}),send(graph,{metaKey:true}),send(document.body)];editor.remove();return results;
      });assert.deepEqual(guardResults,Array(8).fill(false),'editing/composition/unsupported modifiers/outside scope are not intercepted');
      console.log('PASS: native Control+K/Meta+K from diagram cards, details headings and source links reveals/selects search at 320/768/1280px; replacement typing works without case/view/evidence/refetch changes, and synthetic editing/composition/modifier/scope guards remain untouched.');
      assert.ok(nodes.some(n=>!n.ignored&&n.role?.value==='group'&&n.name?.value==='Interactive case and source connection diagram'));
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});await page.reload();
        await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
        assert.ok(await page.locator('#skipDiagram').evaluate(el=>el.getBoundingClientRect().bottom<0),'skip link initially offscreen');
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#skipDiagram').evaluate(el=>el===document.activeElement),true,'skip link is first keyboard stop');
        assert.ok(await page.locator('#skipDiagram').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.right<=innerWidth}),'focused skip link is visible');
        const hash=new URL(page.url()).hash,view=await page.locator('#graph').getAttribute('viewBox');
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#graph').evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#graph').getAttribute('tabindex'),'-1');
        assert.equal(await page.locator('#graph').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
        assert.ok(await page.locator('#graph').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}),'diagram brought into view');
        assert.equal(new URL(page.url()).hash,hash,'skip does not replace the case hash');
        assert.equal(await page.locator('#graph').getAttribute('viewBox'),view);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#graph .node').first().evaluate(el=>el===document.activeElement),true,'Tab enters first evidence card');
        await page.keyboard.press('Enter');await page.keyboard.press('Escape');
        assert.equal(await page.locator('#graph .node').first().evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#graph .node').count(),3);
      }
      console.log('PASS: first-Tab skip link appears on focus, Enter focuses and reveals the evidence diagram, Tab reaches its first card, Enter/Escape still work, and case hash/zoom remain unchanged at 320/768/1280px.');
      for(const forced of [false,true]) {
        await page.emulateMedia({forcedColors:forced?'active':'none'});
        for(const width of [320,768,1280]) {
          await page.setViewportSize({width,height:900});
          for(const zoomed of [false,true]) {
            await page.locator('#resetView').click();if(zoomed)await page.locator('#zoomIn').click();
            const hash=new URL(page.url()).hash;
            await page.locator('#resetView').press('Tab');
            for(const i of [0,1,2]) {
              const card=page.locator('#graph .node').nth(i);
              assert.equal(await card.evaluate(el=>el===document.activeElement),true);
              const ring=await card.locator('rect').first().evaluate(el=>{const s=getComputedStyle(el);return {width:s.strokeWidth,stroke:s.stroke,vector:s.vectorEffect}});
              assert.equal(ring.width,'3px','focus is drawn on the full card border');
              assert.equal(ring.vector,'non-scaling-stroke','focus thickness does not shrink with diagram scale');
              assert.notEqual(ring.stroke,'none');if(!forced)assert.equal(ring.stroke,'rgb(255, 255, 255)');
              if(i)assert.equal(await card.locator('circle').count(),0,'source card indicator does not depend on a circular icon');
              if(i<2)await page.keyboard.press('Tab');
            }
            await page.keyboard.press('Shift+Tab');
            assert.equal(await page.locator('#graph .node').nth(1).evaluate(el=>el===document.activeElement),true);
            await page.keyboard.press('Enter');
            assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
            assert.equal(await page.locator('#graph .node').nth(1).locator('rect').first().evaluate(el=>getComputedStyle(el).strokeWidth),'1.2px','card reverts after focus moves to inspected details');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#graph .node').nth(1).evaluate(el=>el===document.activeElement),true);
            assert.equal(await page.locator('#graph .node').nth(1).locator('rect').first().evaluate(el=>getComputedStyle(el).strokeWidth),'3px');
            assert.equal(new URL(page.url()).hash,hash);
          }
        }
      }
      await page.emulateMedia({forcedColors:'none'});await page.locator('#resetView').click();
      console.log('PASS: native Tab/Shift+Tab exposes a 3px non-scaling full-card focus stroke on case/source cards at 320/768/1280px and 100%/125% diagram zoom, including forced colors; Enter moves focus to details, Escape restores the card ring, blur restores the normal source border and case identity is unchanged.');
      assert.equal(await page.locator('#graph').getAttribute('aria-describedby'),'diagramKeys');
      assert.match(await page.locator('#diagramKeys').textContent(),/arrow keys to pan the view/);
      const readView=async()=> (await page.locator('#graph').getAttribute('viewBox')).split(' ').map(Number);
      assert.match(await page.locator('#diagramKeys').textContent(),/Escape stops an active drag/);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const zoomClicks of [1,5]) {
          await page.locator('#resetView').click();
          for(let i=0;i<zoomClicks;i++)await page.locator('#zoomIn').click();
          const start=await readView(),cards=await page.locator('#graph').innerHTML(),hash=new URL(page.url()).hash,zoomText=await page.locator('#zoomStatus').textContent();
          await page.locator('#resetView').press('Tab');
          assert.deepEqual(await readView(),start,'already visible case keeps its position on keyboard entry');
          for(const [index,key] of [[0,null],[1,'Tab'],[2,'Tab'],[1,'Shift+Tab'],[0,'Shift+Tab']]) {
            if(key)await page.keyboard.press(key);
            const card=page.locator('#graph .node').nth(index);
            assert.equal(await card.evaluate(el=>el===document.activeElement),true,'native Tab/Shift+Tab reaches the expected card');
            const visible=await card.evaluate(el=>{const r=el.querySelector('rect').getBoundingClientRect(),g=el.ownerSVGElement.getBoundingClientRect();return {ok:r.left>=g.left-1&&r.right<=g.right+1&&r.top>=g.top-1&&r.bottom<=g.bottom+1&&r.top>=-1&&r.bottom<=innerHeight+1,rect:r.toJSON(),graph:g.toJSON(),height:innerHeight}});
            assert.ok(visible.ok,`keyboard card ${index} fully visible at ${width}px, zoom clicks ${zoomClicks}: ${JSON.stringify(visible)}`);
            assert.deepEqual((await readView()).slice(2),start.slice(2),'keyboard reveal preserves zoom');
            assert.equal(await page.locator('#zoomStatus').textContent(),zoomText);
            assert.equal(await page.locator('#graph').innerHTML(),cards);
            assert.equal(new URL(page.url()).hash,hash);
          }
        }
        await page.locator('#resetView').click();await page.locator('#zoomIn').click();
        await page.locator('#graph').scrollIntoViewIfNeeded();
        const beforePointer=await readView();
        const point=await page.locator('#graph .node').nth(1).evaluate(el=>{const r=el.querySelector('rect').getBoundingClientRect(),g=el.ownerSVGElement.getBoundingClientRect();return {x:(Math.max(r.left,g.left)+Math.min(r.right,g.right))/2,y:(Math.max(r.top,g.top)+Math.min(r.bottom,g.bottom))/2}});
        await page.mouse.click(point.x,point.y);
        assert.equal(await page.locator('#detail h2').textContent(),'Fixture source A');
        assert.deepEqual(await readView(),beforePointer,'pointer inspection does not recenter a partially clipped source card');
      }
      await page.locator('#resetView').click();
      console.log('PASS: native Tab/Shift+Tab reveals cards at 125%/maximum zoom across 320/768/1280px, preserving zoom/evidence; pointer inspection preserves view.');

      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const zoomed of [false,true]) {
          await page.locator('#resetView').click();if(zoomed)await page.locator('#zoomIn').click();
          await page.locator('#graph').scrollIntoViewIfNeeded();
          const box=await page.locator('#graph').boundingBox(),x=box.x+12,y=box.y+12;
          const start=await readView(),cards=await page.locator('#graph').innerHTML(),hash=new URL(page.url()).hash;
          for(const button of ['right','middle']) {
            await page.mouse.move(x,y);await page.mouse.down({button});await page.mouse.move(x+20,y+10,{steps:2});await page.mouse.up({button});
            await page.keyboard.press('Escape');
            assert.deepEqual(await readView(),start,button+' button does not initiate diagram panning');
          }
          await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+20,y+10,{steps:2});
          const moved=await readView(),focus=await page.evaluate(()=>document.activeElement?.id);assert.notDeepEqual(moved,start,'native held drag pans before cancellation');
          assert.deepEqual(moved.slice(2),start.slice(2));
          await page.keyboard.press('Escape');
          await page.mouse.move(x+40,y+20,{steps:2});
          assert.deepEqual(await readView(),moved,'Escape stops held-pointer movement at the current view');
          await page.mouse.up();await page.mouse.move(x+50,y+25);assert.deepEqual(await readView(),moved,'released pointer does not resume cancelled pan');
          assert.equal(await page.evaluate(()=>document.activeElement?.id),focus,'cancelling does not steal focus');
          assert.equal(await page.locator('#graph').innerHTML(),cards);assert.equal(new URL(page.url()).hash,hash);
          await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+10,y+5);await page.mouse.up();
          assert.notDeepEqual(await readView(),moved,'a fresh drag works after Escape');
          await page.locator('#resetView').click();
        }
      }
      console.log('PASS: native right/middle drags leave diagram view unchanged; native held main-button mouse drag pans then Escape stops further movement at 320/768/1280px and 100%/125% scale; zoom/cards/hash/focus stay intact and a fresh drag works.');
      assert.equal(await page.locator('#panTools').getAttribute('open'),null);
      assert.equal(await page.getByRole('button',{name:'Move view left',exact:true}).count(),0,'collapsed controls are outside accessible buttons');
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        await page.locator('#panTools summary').press('Enter');
        assert.equal(await page.locator('#panLeft').isVisible(),true);
        for(const zoomed of [false,true]) {
          await page.locator('#resetView').click();if(zoomed)await page.locator('#zoomIn').click();
          const initial=await readView(),cards=await page.locator('#graph .node').evaluateAll(els=>els.map(el=>el.outerHTML)),hash=new URL(page.url()).hash;
          for(const [id,dx,dy] of [['panRight',1,0],['panDown',0,1],['panLeft',-1,0],['panUp',0,-1]]) {
            const before=await readView(),button=page.locator('#'+id);await button.click();const after=await readView();
            assert.ok(Math.abs(after[0]-before[0]-dx*before[2]/10)<1e-8);
            assert.ok(Math.abs(after[1]-before[1]-dy*before[3]/10)<1e-8);
            assert.deepEqual(after.slice(2),before.slice(2));
            assert.ok(await button.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth}));
          }
          const restored=await readView();initial.forEach((n,i)=>assert.ok(Math.abs(restored[i]-n)<1e-8));
          assert.deepEqual(await page.locator('#graph .node').evaluateAll(els=>els.map(el=>el.outerHTML)),cards);
          assert.equal(new URL(page.url()).hash,hash);
          await page.locator('#panLeft').press('Space');assert.ok((await readView())[0]<initial[0]);
          await page.locator('#resetView').click();assert.deepEqual(await readView(),[0,0,760,520]);
        }
        await page.locator('#panTools summary').press('Enter');
        assert.equal(await page.locator('#panLeft').isVisible(),false);
      }
      console.log('PASS: compact movement disclosure opens/closes by keyboard; four single-click pan buttons preserve zoom/cards/hash at 100%/125% and 320/768/1280px, have 44px targets, support Space, and Reset restores the view.');

      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const cardIndex of [0,1])for(const zoomed of [false,true]) {
          await page.locator('#resetView').click();
          if(zoomed)await page.locator('#zoomIn').click();
          const card=page.locator('#graph .node').nth(cardIndex);
          await card.focus();
          const initial=await readView(),cards=await page.locator('#graph .node').evaluateAll(els=>els.map(el=>el.outerHTML)),hash=new URL(page.url()).hash;
          const scroll=await page.evaluate(()=>scrollY),zoomText=await page.locator('#zoomStatus').textContent();
          for(const [key,dx,dy] of [['ArrowRight',1,0],['ArrowDown',0,1],['ArrowLeft',-1,0],['ArrowUp',0,-1]]) {
            const before=await readView();await page.keyboard.press(key);const after=await readView();
            assert.ok(Math.abs(after[0]-before[0]-dx*before[2]/10)<1e-8);
            assert.ok(Math.abs(after[1]-before[1]-dy*before[3]/10)<1e-8);
            assert.deepEqual(after.slice(2),before.slice(2),'panning preserves zoom');
            assert.equal(await card.evaluate(el=>el===document.activeElement),true);
            assert.equal(await page.evaluate(()=>scrollY),scroll,'diagram arrows do not scroll the page');
          }
          const restored=await readView();initial.forEach((n,i)=>assert.ok(Math.abs(restored[i]-n)<1e-8));
          assert.deepEqual(await page.locator('#graph .node').evaluateAll(els=>els.map(el=>el.outerHTML)),cards,'pan does not move or rebuild evidence cards');
          assert.equal(new URL(page.url()).hash,hash);
          assert.equal(await page.locator('#zoomStatus').textContent(),zoomText);
          await page.keyboard.press('Shift+ArrowRight');assert.deepEqual(await readView(),restored,'modified arrows untouched');
          await page.keyboard.press('Enter');assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
          await page.keyboard.press('Escape');assert.equal(await card.evaluate(el=>el===document.activeElement),true);
          const returnedView=await readView(); // Escape may reveal a card clipped by zoom; the text-field arrow must preserve that returned view.
          await page.locator('#search').fill('Fixture');await page.locator('#search').press('ArrowLeft');
          assert.deepEqual(await readView(),returnedView,'arrow in text input does not pan');
        }
      }
      assert.match(await page.locator('#diagramKeys').textContent(),/Home centers the focused card without changing zoom/);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const cardIndex of [0,1])for(const zoomed of [false,true]) {
          await page.locator('#resetView').click();if(zoomed)await page.locator('#zoomIn').click();
          const card=page.locator('#graph .node').nth(cardIndex);
          await card.focus();
          const point=await card.locator('rect').first().evaluate(el=>({x:Number(el.getAttribute('x'))+Number(el.getAttribute('width'))/2,y:Number(el.getAttribute('y'))+Number(el.getAttribute('height'))/2}));
          const cards=await page.locator('#graph .node').evaluateAll(els=>els.map(el=>el.outerHTML)),hash=new URL(page.url()).hash;
          for(let i=0;i<8;i++)await page.keyboard.press('ArrowRight');
          const before=await readView(),zoomText=await page.locator('#zoomStatus').textContent(),scroll=await page.evaluate(()=>scrollY);
          assert.ok(point.x<before[0],'fixture pans the focused card out of the diagram view');
          await page.keyboard.press('Home');
          const centered=await readView();
          assert.ok(Math.abs(centered[0]+centered[2]/2-point.x)<1e-8);
          assert.ok(Math.abs(centered[1]+centered[3]/2-point.y)<1e-8);
          assert.deepEqual(centered.slice(2),before.slice(2),'Home preserves diagram scale');
          assert.equal(await page.locator('#zoomStatus').textContent(),zoomText);
          assert.equal(await card.evaluate(el=>el===document.activeElement),true);
          assert.equal(await page.evaluate(()=>scrollY),scroll,`card Home does not scroll the whole page at ${width}px, card ${cardIndex}, zoomed=${zoomed}`);
          assert.ok(await card.locator('rect').first().evaluate(el=>{const c=el.getBoundingClientRect(),g=el.closest('svg').getBoundingClientRect();return c.left>=g.left&&c.right<=g.right&&c.top>=g.top&&c.bottom<=g.bottom}),'centered evidence card is fully in view');
          assert.deepEqual(await page.locator('#graph .node').evaluateAll(els=>els.map(el=>el.outerHTML)),cards,'evidence coordinates/content are unchanged');
          assert.equal(new URL(page.url()).hash,hash);
          await page.keyboard.press('Home');assert.deepEqual(await readView(),centered,'centering is repeatable');
          await page.keyboard.press('ArrowRight');const modified=await readView();
          await page.keyboard.press('Control+Home');assert.deepEqual(await readView(),modified,'modified Home is not intercepted');
          await page.waitForFunction(()=>scrollY===0); // Let native page scrolling finish before the next card-recovery interaction.
          await page.keyboard.press('Home');
          await page.keyboard.press('Enter');await page.keyboard.press('Escape');
          assert.equal(await card.evaluate(el=>el===document.activeElement),true,'inspection and Escape retain the recovered card');
          const view=await readView();await page.locator('#search').fill('Fixture');await page.locator('#search').press('Home');
          assert.deepEqual(await readView(),view,'text-field Home does not pan the diagram');
          assert.equal(await page.locator('#search').evaluate(el=>el.selectionStart),0,'native text-field Home still moves the caret');
        }
      }
      console.log('PASS: native Home recovers an off-view focused case/source card at 320/768/1280px and 100%/125% diagram scale, preserving zoom/focus/hash/card data/page scroll; centering repeats, Enter/Escape still work and modified/text-field Home retain native behavior.');
      await page.locator('#search').fill('');await page.locator('#resetView').click();
      console.log('PASS: all four native arrow keys pan the diagram from case/source cards at 100%/125% and 320/768/1280px; focus, zoom, evidence coordinates and case hash stay intact, page scrolling is prevented, and modified/text-input arrows plus Enter/Escape keep their behavior.');
      assert.equal(await page.locator('#zoomStatus').getAttribute('role'),'status');
      assert.equal(await page.locator('#zoomStatus').getAttribute('aria-atomic'),'true');
      for(const id of ['zoomIn','zoomOut','resetView'])assert.equal(await page.locator('#'+id).getAttribute('aria-describedby'),'zoomStatus');
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        const targets=await page.locator('#zoomIn, #zoomOut, #resetView').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,width:r.width,height:r.height,left:r.left,right:r.right,viewport:innerWidth}}));
        for(const target of targets) {
          assert.ok(target.width>=44&&target.height>=44,target.id+' has a 44px minimum pointer target');
          assert.ok(target.left>=0&&target.right<=target.viewport,target.id+' fits the viewport');
        }
        for(let i=1;i<targets.length;i++)assert.ok(targets[i].left>=targets[i-1].right,'zoom targets do not overlap');
        await page.locator('#resetView').press('Enter');
        const caseHash=new URL(page.url()).hash,title=await page.locator('#detail h2').textContent();
        assert.equal(await page.locator('#zoomStatus').textContent(),'Diagram zoom: 100%.');
        await page.locator('#zoomIn').press('Enter');
        assert.equal(await page.locator('#zoomStatus').textContent(),'Diagram zoom: 125%.');
        assert.equal(await page.locator('#zoomIn').evaluate(el=>el===document.activeElement),true);
        await page.locator('#zoomOut').press('Space');
        assert.equal(await page.locator('#zoomStatus').textContent(),'Diagram zoom: 100%.');
        for(let i=0;i<10;i++)await page.locator('#zoomIn').press('Enter');
        assert.equal(await page.locator('#zoomStatus').textContent(),'Diagram zoom: 304% (maximum).');
        const capped=await page.locator('#graph').getAttribute('viewBox');
        await page.locator('#zoomIn').press('Space');
        assert.equal(await page.locator('#graph').getAttribute('viewBox'),capped);
        assert.equal(await page.locator('#zoomIn').evaluate(el=>el===document.activeElement),true);
        for(let i=0;i<12;i++)await page.locator('#zoomOut').press('Enter');
        assert.equal(await page.locator('#zoomStatus').textContent(),'Diagram zoom: 54% (minimum).');
        assert.ok(await page.locator('#zoomStatus').evaluate(el=>el.getBoundingClientRect().left>=0&&el.getBoundingClientRect().right<=innerWidth));
        await page.locator('#resetView').press('Enter');
        assert.equal(await page.locator('#zoomStatus').textContent(),'Diagram zoom: 100%.');
        assert.equal(await page.locator('#graph').getAttribute('viewBox'),'0 0 760 520');
        await page.locator('#graph').hover();await page.mouse.wheel(0,100);
        await page.waitForFunction(()=>document.querySelector('#zoomStatus').textContent==='Diagram zoom: 89%.');
        await page.locator('#resetView').click();
        assert.equal(await page.locator('#zoomStatus').textContent(),'Diagram zoom: 100%.');
        assert.equal(new URL(page.url()).hash,caseHash);
        assert.equal(await page.locator('#detail h2').textContent(),title);
        assert.equal(await page.locator('#graph .node').count(),3);
      }
      console.log('PASS: zoom in/out/reset have non-overlapping 44px minimum targets within 320/768/1280px viewports; native diagram zoom status tracks native Enter/Space, wheel, existing minimum/maximum and Reset at 320/768/1280px without moving keyboard focus or changing the case/source cards.');
      for(const width of [320,768,1280])for(const cardIndex of [0,1]) {
        await page.setViewportSize({width,height:900});await page.locator('#resetView').click();
        const card=page.locator('#graph .node').nth(cardIndex),cards=await page.locator('#graph').innerHTML(),hash=new URL(page.url()).hash;
        await card.press('Enter');assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
        await page.locator('#graph').hover();
        for(let i=0;i<6;i++) {
          await page.mouse.wheel(0,-100);
          await page.waitForFunction(expected=>Math.abs(Number(document.querySelector('#graph').getAttribute('viewBox').split(' ')[2])-expected)<1e-7,760*.89**(i+1));
        }
        const before=await readView(),zoom=await page.locator('#zoomStatus').textContent();
        const rect=await card.locator('rect').first().evaluate(el=>{const r=el.getBBox();return {x:r.x,y:r.y,width:r.width,height:r.height}});
        assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true,'wheel changes the view while inspected details keep keyboard focus');
        if(cardIndex)assert.ok(rect.y+rect.height<before[1],'zoom fixture moves source card entirely outside diagram view');
        await page.keyboard.press('Escape');
        const recovered=await readView();assert.deepEqual(recovered.slice(2),before.slice(2),'return preserves current zoom');
        assert.equal(await page.locator('#zoomStatus').textContent(),zoom);assert.equal(await card.evaluate(el=>el===document.activeElement),true);
        if(cardIndex){assert.ok(Math.abs(recovered[0]+recovered[2]/2-rect.x-rect.width/2)<1e-7);assert.ok(Math.abs(recovered[1]+recovered[3]/2-rect.y-rect.height/2)<1e-7)}
        else assert.deepEqual(recovered,before,'already-visible case card does not recenter the view');
        assert.ok(await card.locator('rect').first().evaluate(el=>{const r=el.getBoundingClientRect(),g=el.closest('svg').getBoundingClientRect();return r.left>=g.left&&r.right<=g.right&&r.top>=g.top&&r.bottom<=g.bottom&&r.top>=0&&r.bottom<=innerHeight}),'returned card is within both diagram and visible page');
        assert.equal(await page.locator('#graph').innerHTML(),cards,'card coordinates/content unchanged');assert.equal(new URL(page.url()).hash,hash);
        await page.keyboard.press('Enter');await page.keyboard.press('Escape');assert.deepEqual(await readView(),recovered,'visible return keeps the recovered view');
        await page.locator('#resetView').click();
      }
      console.log('PASS: after native wheel zoom with details focused, Escape reveals an off-view source card without resetting zoom at 320/768/1280px; visible case cards do not recenter, exact evidence/hash/focus remain, and repeated inspection/return stays stable.');

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
      const draftStorageKey='evidence-atlas-connection-drafts-v1';
      const previousDrafts=await page.evaluate(key=>localStorage.getItem(key),draftStorageKey);
      const draftDestination='https://records.example/draft?record='+ 'x'.repeat(300)+'&id=42#page=7';
      await page.locator('#newTrail').click();
      await page.locator('#draftTitle').fill('Draft destination fixture');
      await page.locator('#draftUrl').fill(draftDestination);
      await page.getByRole('button',{name:'Save private draft',exact:true}).click();
      const safeDrafts=await page.evaluate(key=>localStorage.getItem(key),draftStorageKey);
      const rejectedDraftUrls=['javascript:alert(1)','file:///fixture','data:text/html,fixture','/relative','https://user:password@records.example/private'];
      await page.evaluate(({key,urls})=>{const drafts=JSON.parse(localStorage.getItem(key));urls.forEach((url,i)=>drafts.push({type:'trail',title:'Legacy draft '+i,url}));localStorage.setItem(key,JSON.stringify(drafts))},{key:draftStorageKey,urls:rejectedDraftUrls});
      const legacyDrafts=await page.evaluate(key=>localStorage.getItem(key),draftStorageKey);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});await page.reload();
        await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
        const draftLink=page.locator('#draftList').getByRole('link',{name:'Open draft URL at records.example (opens in new tab)',exact:true});
        assert.equal(await page.locator('#draftList a').count(),1,'unsafe legacy URLs do not become actionable links');
        assert.equal(await draftLink.getAttribute('href'),draftDestination,'draft query and fragment are preserved');
        assert.equal(await draftLink.getAttribute('target'),'_blank');
        assert.equal(await draftLink.getAttribute('rel'),'noopener noreferrer');
        const draftBox=page.locator('#draftList > div').nth(1);
        assert.equal(await draftBox.locator('p').last().textContent(),'Draft URL: '+draftDestination);
        assert.ok(await draftBox.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),'full draft URL wraps');
        assert.equal(await page.locator('#draftList').getByText('Draft URL cannot be opened: use an absolute HTTP(S) URL without embedded credentials.',{exact:true}).count(),5);
        assert.ok(!(await page.locator('#draftList').textContent()).includes('user:password'),'credentials are not echoed');
        await page.locator('#exportDrafts').focus();await page.keyboard.press('Tab');
        assert.equal(await page.locator('#draftList button').first().evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Tab');
        assert.equal(await draftLink.evaluate(el=>el===document.activeElement),true,'native Tab reaches the explicitly named destination');
        assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftStorageKey),legacyDrafts,'preview does not rewrite stored drafts');
      }
      assert.equal(JSON.parse(safeDrafts).at(-1).url,draftDestination,'normal form Save retains the complete URL');
      await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:draftStorageKey,value:previousDrafts});
      await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      console.log('PASS: private trail form Save and native Tab expose exact host/new-tab draft destinations with query/fragment and wrapping at 320/768/1280px; unsafe/relative/credential legacy URLs are non-actionable without credential echoes or stored-draft rewrites.');
      const deleteFixtures=[{type:'case',title:'First deletion fixture',notes:'Keep first'},
        {type:'trail',title:'Middle deletion fixture',notes:'Keep middle',url:'https://records.example/keep'},
        {type:'case',title:'Last deletion fixture',notes:'Keep last'}];
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(({key,drafts})=>localStorage.setItem(key,JSON.stringify(drafts)),{key:draftStorageKey,drafts:deleteFixtures});
        await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
        const form=await page.locator('#draftForm').getAttribute('hidden');
        const firstDelete=page.getByRole('button',{name:'Delete draft: First deletion fixture',exact:true});
        await firstDelete.focus();await page.keyboard.press('Enter');
        const middleDelete=page.getByRole('button',{name:'Delete draft: Middle deletion fixture',exact:true});
        assert.equal(await middleDelete.evaluate(el=>el===document.activeElement),true,'deleting the first row focuses the next draft');
        assert.equal(await middleDelete.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
        assert.equal(await page.locator('#draftStatus').textContent(),'Draft deleted from this browser. 2 private drafts remain.');
        assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),draftStorageKey),deleteFixtures.slice(1),'only the activated draft is removed');
        const lastDelete=page.getByRole('button',{name:'Delete draft: Last deletion fixture',exact:true});
        await lastDelete.focus();await page.keyboard.press('Space');
        assert.equal(await middleDelete.evaluate(el=>el===document.activeElement),true,'deleting the last row focuses the previous draft');
        assert.equal(await page.locator('#draftStatus').textContent(),'Draft deleted from this browser. 1 private draft remains.');
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#newCase').evaluate(el=>el===document.activeElement),true,'deleting the final draft reaches Add case');
        assert.equal(await page.locator('#draftList button').count(),0);
        assert.match(await page.locator('#draftList').textContent(),/No private drafts saved yet/);
        assert.equal(await page.locator('#draftStatus').textContent(),'Draft deleted from this browser. 0 private drafts remain.');
        assert.equal(await page.locator('#draftForm').getAttribute('hidden'),form,'deletion does not open the contribution form');
        assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),draftStorageKey),[]);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#newTrail').evaluate(el=>el===document.activeElement),true,'Tab continues normally after deleting the final draft');
      }
      await page.evaluate(({key,drafts})=>localStorage.setItem(key,JSON.stringify(drafts)),{key:draftStorageKey,drafts:deleteFixtures});
      await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      await page.evaluate(()=>{window.fixtureSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Fixture storage blocked','QuotaExceededError')}});
      const blockedDelete=page.getByRole('button',{name:'Delete draft: Middle deletion fixture',exact:true});
      await blockedDelete.focus();await page.keyboard.press('Enter');
      assert.equal(await blockedDelete.evaluate(el=>el===document.activeElement),true,'storage failure retains focus on the existing control');
      assert.equal(await page.locator('#draftList button').count(),3);
      assert.equal(await page.locator('#draftStatus').textContent(),'Could not delete draft. Browser storage unavailable; your draft remains listed.');
      assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),draftStorageKey),deleteFixtures,'failed delete preserves every draft');
      await page.evaluate(({key,value})=>{Storage.prototype.setItem=window.fixtureSetItem;delete window.fixtureSetItem;localStorage.setItem(key,value)},{key:draftStorageKey,value:previousDrafts});
      await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      console.log('PASS: native Enter/Space draft deletion retains named next/previous focus and visible outline at 320/768/1280px; last removal focuses Add case with normal Tab continuation and accurate status; storage failure preserves all drafts, row controls and focus without page errors.');
      let draftDownloads=0;page.on('download',()=>draftDownloads++);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        const requests=caseRequests;
        await page.evaluate(key=>{window.fixtureGetItem=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===key)throw new DOMException('Fixture blocked read','SecurityError');return window.fixtureGetItem.call(this,k)}},draftStorageKey);
        await page.locator('#exportDrafts').press('Enter');
        assert.equal(await page.locator('#exportDrafts').isDisabled(),true,'unreadable drafts cannot be exported as an empty archive');
        assert.match(await page.locator('#draftList').textContent(),/Saved drafts cannot be read/);
        assert.doesNotMatch(await page.locator('#draftList').textContent(),/No private drafts saved yet/);
        assert.equal(await page.locator('#retryDrafts').evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#retryDrafts').evaluate(el=>el===document.activeElement),true,'failed retry keeps a live retry control focused');
        await page.locator('#newCase').click();await page.locator('#draftTitle').fill('Preserve unreadable-store draft');
        await page.getByRole('button',{name:'Save private draft',exact:true}).click();
        assert.equal(await page.locator('#draftForm').isVisible(),true);
        assert.equal(await page.locator('#draftTitle').inputValue(),'Preserve unreadable-store draft');
        assert.equal(await page.evaluate(key=>window.fixtureGetItem.call(localStorage,key),draftStorageKey),previousDrafts,'blocked read cannot overwrite existing stored drafts');
        await page.evaluate(()=>{Storage.prototype.getItem=window.fixtureGetItem;delete window.fixtureGetItem});
        await page.locator('#retryDrafts').press('Enter');
        assert.equal(await page.locator('#exportDrafts').isDisabled(),false);
        assert.equal(await page.locator('#exportDrafts').evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#draftStatus').textContent(),'Saved drafts are available again.');
        assert.match(await page.locator('#draftList').textContent(),/Unsaved fixture/);
        assert.equal(await page.locator('#draftTitle').inputValue(),'Preserve unreadable-store draft');
        assert.equal(caseRequests,requests,'draft retry does not reload public data or the page');
        await page.locator('#cancelDraft').click();
        for(const unreadable of ['', '{broken','{"unexpected":"object"}']) {
          await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:draftStorageKey,value:unreadable});
          await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
          assert.equal(await page.locator('#exportDrafts').isDisabled(),true);
          assert.match(await page.locator('#draftList').textContent(),/Saved drafts cannot be read/);
          await page.locator('#newCase').click();await page.locator('#draftTitle').fill('Do not overwrite unreadable JSON');
          await page.getByRole('button',{name:'Save private draft',exact:true}).click();
          assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftStorageKey),unreadable);
          assert.equal(await page.locator('#draftTitle').inputValue(),'Do not overwrite unreadable JSON');
          await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:draftStorageKey,value:previousDrafts});
          await page.locator('#retryDrafts').press('Space');
          assert.equal(await page.locator('#exportDrafts').isDisabled(),false);
          assert.equal(await page.locator('#exportDrafts').evaluate(el=>el===document.activeElement),true);
          assert.match(await page.locator('#draftList').textContent(),/Unsaved fixture/);
          await page.locator('#cancelDraft').click();
        }
      }
      assert.equal(draftDownloads,0,'failed reads never produce a download');
      console.log('PASS: blocked draft reads, invalid JSON and non-array storage show unavailable rather than empty at 320/768/1280px; export is withheld, Save cannot overwrite bytes, Retry preserves text/focus and recovers existing drafts without public refetch or empty downloads.');
      for(const width of [320,768,1280])for(const [trigger,type] of [['newCase','case'],['newTrail','trail']]) {
        await page.setViewportSize({width,height:900});
        const before=await page.evaluate(key=>localStorage.getItem(key),draftStorageKey),requests=caseRequests,hash=new URL(page.url()).hash;
        assert.equal(await page.locator('#downloadUnsavedDraft').isVisible(),false);
        await page.locator('#'+trigger).click();
        await page.locator('#draftTitle').fill('Unsaved recovery fixture');await page.locator('#draftRelated').fill('Case #1');
        await page.locator('#draftUrl').fill('https://records.example/unsaved?version=1#notes');await page.locator('#draftNotes').fill('Original recovery notes');
        await page.evaluate(()=>{window.fixtureSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Fixture write quota','QuotaExceededError')}});
        await page.getByRole('button',{name:'Save private draft',exact:true}).press('Enter');
        assert.equal(await page.locator('#draftForm').isVisible(),true);assert.equal(await page.locator('#downloadUnsavedDraft').isVisible(),true);
        assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftStorageKey),before);
        await page.locator('#draftTitle').fill('Edited recovery fixture');await page.locator('#draftNotes').fill('Updated notes after failed Save');
        const recovery=page.getByRole('button',{name:'Download unsaved draft',exact:true});
        assert.ok(await recovery.evaluate(el=>el.getBoundingClientRect().right<=innerWidth),'recovery action fits phone/tablet/desktop');
        const downloadCount=draftDownloads;
        await page.locator('#draftTitle').fill('   ');await recovery.press('Enter');
        assert.equal(draftDownloads,downloadCount);assert.equal(await page.locator('#draftTitle').getAttribute('aria-invalid'),'true');
        await page.locator('#draftTitle').fill('Edited recovery fixture');
        if(type==='trail') {
          await page.locator('#draftUrl').fill('');await recovery.press('Enter');
          assert.equal(draftDownloads,downloadCount);assert.equal(await page.locator('#draftUrl').evaluate(el=>el===document.activeElement),true);
          await page.locator('#draftUrl').fill('https://records.example/unsaved?version=1#notes');
        }
        const pending=page.waitForEvent('download');await recovery.press('Enter');const download=await pending;
        assert.equal(download.suggestedFilename(),'evidence-atlas-unsaved-draft.json');
        const data=JSON.parse(await readFile(await download.path(),'utf8'));
        assert.equal(data.format,'evidence-atlas-drafts-v1');assert.equal(data.drafts.length,1,'recovery downloads only current form, not saved drafts');
        const d=data.drafts[0];assert.equal(d.type,type);assert.equal(d.title,'Edited recovery fixture');assert.equal(d.related,'Case #1');assert.equal(d.url,'https://records.example/unsaved?version=1#notes');assert.equal(d.notes,'Updated notes after failed Save');assert.equal(d.review_status,'unsubmitted');assert.ok(Number.isFinite(Date.parse(d.created_at)));
        assert.equal(await recovery.evaluate(el=>el===document.activeElement),true);assert.equal(await page.locator('#draftForm').isVisible(),true);
        assert.equal(await page.locator('#draftNotes').inputValue(),d.notes);assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftStorageKey),before);
        assert.equal(new URL(page.url()).hash,hash);assert.equal(caseRequests,requests,'recovery does not refetch or publish');
        assert.match(await page.locator('#draftStatus').textContent(),/not saved in this browser or published/);
        await page.evaluate(()=>{Storage.prototype.setItem=window.fixtureSetItem;delete window.fixtureSetItem});
        await page.getByRole('button',{name:'Save private draft',exact:true}).press('Enter');
        assert.equal(await page.locator('#draftForm').isVisible(),false);assert.equal(await recovery.isVisible(),false);
        assert.equal(await page.locator('#'+trigger).evaluate(el=>el===document.activeElement),true);
        const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),draftStorageKey);assert.equal(saved.length,JSON.parse(before).length+1);assert.equal(saved.at(-1).title,d.title);
        await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:draftStorageKey,value:before});await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      }
      console.log('PASS: failed Save exposes keyboard unsaved-draft download at 320/768/1280px for case/trail forms; parsed JSON contains current edited fields only, with unchanged stored bytes/form/focus/case and no public requests; later successful Save hides recovery and returns focus.');
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const [trigger,type] of [['newCase','case'],['newTrail','trail']]) {
          await page.locator('#'+trigger).click();
          await page.locator('#draftTitle').fill('   ');
          await page.locator('#draftUrl').fill('https://records.example/title-check?id=42#page=7');
          await page.locator('#draftRelated').fill('Keep related context');
          await page.locator('#draftNotes').fill('Keep unfinished evidence notes');
          const before=await page.evaluate(key=>localStorage.getItem(key),draftStorageKey);
          await page.getByRole('button',{name:'Save private draft',exact:true}).press('Enter');
          assert.equal(await page.locator('#draftTitle').evaluate(el=>el===document.activeElement),true,'blank-title rejection focuses the labeled field');
          assert.equal(await page.locator('#draftTitle').getAttribute('aria-invalid'),'true');
          assert.equal(await page.locator('#draftTitle').getAttribute('aria-describedby'),'draftTitleError');
          assert.equal(await page.locator('#draftTitleError').isVisible(),true);
          assert.equal(await page.locator('#draftTitle').evaluate(el=>el.validationMessage),'Enter a title with at least one non-space character.');
          assert.ok(await page.locator('#draftTitleError').evaluate(el=>{const r=el.getBoundingClientRect();return r.right<=innerWidth&&el.scrollWidth<=el.clientWidth}),'specific error fits the viewport');
          assert.equal(await page.locator('#draftNotes').inputValue(),'Keep unfinished evidence notes');
          assert.equal(await page.locator('#draftRelated').inputValue(),'Keep related context');
          assert.equal(await page.evaluate(key=>localStorage.getItem(key),draftStorageKey),before,'invalid submission does not save');
          await page.locator('#draftTitle').fill('  Corrected title fixture  ');
          assert.equal(await page.locator('#draftTitle').getAttribute('aria-invalid'),null);
          assert.equal(await page.locator('#draftTitle').getAttribute('aria-describedby'),null);
          assert.equal(await page.locator('#draftTitleError').isVisible(),false);
          assert.equal(await page.locator('#draftTitle').evaluate(el=>el.validationMessage),'','editing clears stale custom validity');
          await page.getByRole('button',{name:'Save private draft',exact:true}).press('Space');
          assert.equal(await page.locator('#draftForm').isVisible(),false);
          assert.equal(await page.locator('#'+trigger).evaluate(el=>el===document.activeElement),true);
          const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),draftStorageKey);
          assert.equal(stored.length,JSON.parse(before).length+1);
          assert.equal(stored.at(-1).type,type);assert.equal(stored.at(-1).title,'Corrected title fixture');
          assert.equal(stored.at(-1).notes,'Keep unfinished evidence notes');
          assert.equal(stored.at(-1).related,'Keep related context');
          assert.equal(stored.at(-1).url,'https://records.example/title-check?id=42#page=7');
          assert.equal(await page.locator('#draftTitleError').isVisible(),false,'successful reset clears error state');
          await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:draftStorageKey,value:before});
          await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
        }
      }
      console.log('PASS: native Enter rejects whitespace-only case/trail titles with a visible linked error and field focus at 320/768/1280px without saving or losing notes/context; editing clears custom validity and Space saves exactly one corrected draft with normal reset/focus return.');
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
      const completeStart=references.length,completeCaseStart=cases.length;
      const tailUrl='https://records.example/complete?id=9#page=7';
      for(let i=0;i<7;i++)references.push({case_id:1,title:'Complete citation '+i,publisher:'Fixture archive',url:i===6?tailUrl:'https://records.example/complete?id='+i});
      references.push({case_id:1,title:'Repeated complete record',url:tailUrl},{case_id:1,title:'Blocked credential fixture',url:'https://user:secret@records.example/private'},{case_id:1,title:'Blocked script fixture',url:'javascript:alert(1)'});
      cases.push({id:94,title:'Short citation case'});
      await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===9);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        assert.match(await page.locator('#status').textContent(),/^8 of 11 unique public source records shown/);
        const disclosure=page.locator('#allSources'),summary=disclosure.locator('summary');
        assert.equal(await summary.textContent(),'View all 11 indexed citations');assert.equal(await disclosure.getAttribute('open'),null);
        assert.equal(await disclosure.getByRole('link').count(),0,'closed disclosure hides its links from role navigation');
        const graphHtml=await page.locator('#graph').innerHTML(),view=await page.locator('#graph').getAttribute('viewBox'),requests=caseRequests;
        await summary.press('Enter');assert.equal(await disclosure.locator('li').count(),11);assert.equal(await disclosure.getByRole('link').count(),9,'unsafe records have no actionable link');
        assert.doesNotMatch(await disclosure.textContent(),/user:secret|javascript:alert/);
        const tail=disclosure.locator('a').last();assert.equal(await tail.getAttribute('href'),tailUrl);assert.match(await tail.textContent(),/opens in new tab/);assert.equal(await tail.getAttribute('rel'),'noopener noreferrer');assert.equal(await tail.getAttribute('target'),'_blank');
        assert.ok(await disclosure.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),'full destination list wraps');
        await summary.press('Tab');assert.equal(await disclosure.locator('a').first().evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#graph').innerHTML(),graphHtml);assert.equal(await page.locator('#graph').getAttribute('viewBox'),view);assert.equal(caseRequests,requests);
        await summary.press('Space');assert.equal(await disclosure.getAttribute('open'),null);await summary.press('Enter');
        await tail.focus();await page.goto('https://classic.example/connection-explorer.html#case=94');await page.waitForFunction(()=>document.querySelector('#detail h2').textContent==='Short citation case');
        assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true,'case hash switch restores focus from a removed citation link');assert.equal(await disclosure.isVisible(),false);assert.equal(await disclosure.locator('li').count(),0,'case change removes old citation destinations');
        await page.goto('https://classic.example/connection-explorer.html#case=1');await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===9);assert.equal(await disclosure.getAttribute('open'),null);
      }
      references.splice(completeStart);cases.splice(completeCaseStart);await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      assert.equal(await page.locator('#allSources').isVisible(),false);
      console.log('PASS: cases over eight citations retain eight diagram cards plus a native complete-list disclosure at 320/768/1280px; 11 distinct records/9 safe full links, exact tail query/fragment, true-repeat dedup, keyboard Enter/Space/Tab, no unsafe URL echo, wrapping and hash-switch focus cleanup pass without graph/view/refetch changes.');
      const unavailableRefsStart=references.length,unavailableCasesStart=cases.length,sharedUrl=references[0].url;
      references.push({case_id:9090,title:'Unindexed case citation fixture',url:sharedUrl});
      await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});const card=page.locator('#graph .node').nth(1),graphHtml=await page.locator('#graph').innerHTML(),hash=new URL(page.url()).hash;
        await card.press('Enter');assert.equal(await page.locator('#detail h3').count(),0,'unindexed reference does not imply a navigable related-case section');
        assert.equal(await page.locator('#detail ul').count(),0,'no empty related-case list');
        assert.match(await page.locator('#detail').textContent(),/No other published case in this index cites this exact URL/);
        assert.equal(await page.locator('#detail a').getAttribute('href'),sharedUrl);assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Tab');assert.equal(await page.locator('#detail a').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Escape');assert.equal(await card.evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#graph').innerHTML(),graphHtml);assert.equal(new URL(page.url()).hash,hash);
      }
      cases.push({id:93,title:'Loaded matching fixture'});
      references.push({case_id:93,title:'Loaded shared citation',url:sharedUrl},{case_id:93,title:'Repeated loaded citation',url:sharedUrl});
      await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});await page.locator('#graph .node').nth(1).press('Enter');
        assert.equal(await page.locator('#detail h3').textContent(),'Other cases citing this exact URL');assert.equal(await page.locator('#detail li button').count(),1,'only loaded case appears once despite repeated/unknown references');
        await page.locator('#detail').getByRole('button',{name:'Loaded matching fixture · Case #93',exact:true}).press('Space');await page.waitForFunction(()=>location.hash==='#case=93');
        assert.equal(await page.locator('#detail h2').textContent(),'Loaded matching fixture');await page.keyboard.press('Escape');assert.equal(await page.locator('#graph .node').first().evaluate(el=>el===document.activeElement),true);
        await page.goto('https://classic.example/connection-explorer.html#case=1');await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      }
      references.splice(unavailableRefsStart);cases.splice(unavailableCasesStart);await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      console.log('PASS: references to unindexed cases yield the scoped no-related-case message without empty heading/list; mixed loaded/unknown references show one deduplicated navigable case with exact URL, heading focus, Tab/Space/Escape and unchanged source cards at 320/768/1280px.');
      const exactRefsStart=references.length,exactCasesStart=cases.length;
      const exactFixtures=[
        [90,'Record one','https://records.example/document?id=1#page=2'],
        [91,'Record two','https://records.example/document?id=2#page=2'],
        [92,'Record fragment','https://records.example/document?id=1#page=3']
      ];
      for(const [id,title,url] of exactFixtures){cases.push({id,title:'Exact URL case '+id});references.push({case_id:1,title,url},{case_id:id,title:'Shared '+title,url})}
      references.push({case_id:1,title:'Repeated record one',url:exactFixtures[0][2]});
      await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===6);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await page.getByRole('button',{name:'Repeated record one',exact:true}).count(),0,'identical serialized URL still deduplicates within a case');
        for(const [id,title,url] of exactFixtures) {
          const card=page.locator('#graph').getByRole('button',{name:title,exact:true});await card.press('Enter');
          assert.equal(await page.locator('#detail .indexed-url').textContent(),'Indexed URL: '+url);
          assert.equal(await page.locator('#detail a').getAttribute('href'),url);
          assert.equal(await page.locator('#detail h3').textContent(),'Other cases citing this exact URL');
          assert.equal(await page.locator('#detail li button').count(),1,'same path with a different query or fragment is not a shared citation');
          const related=page.locator('#detail').getByRole('button',{name:'Exact URL case '+id+' · Case #'+id,exact:true});
          await related.press('Enter');await page.waitForFunction(id=>location.hash==='#case='+id,id);
          assert.equal(await page.locator('#detail h2').textContent(),'Exact URL case '+id);
          assert.equal(await page.locator('#graph .node').nth(1).getAttribute('aria-label'),'Shared '+title);
          await page.keyboard.press('Escape');assert.equal(await page.locator('#graph .node').first().evaluate(el=>el===document.activeElement),true);
          await page.goto('https://classic.example/connection-explorer.html#case=1');await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===6);
        }
      }
      references.splice(exactRefsStart);cases.splice(exactCasesStart);
      await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===3);
      console.log('PASS: distinct query/fragment source URLs retain separate cards and exact preview links; related-case navigation excludes same-path different destinations at 320/768/1280px, while true duplicates still deduplicate and Enter/Escape retain exact case identity.');
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
      ignoreHashNavigation=true;
      await page.goto('https://classic.example/connection-explorer.html#case=1');await page.reload();
      await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===7);
      await page.goto('https://classic.example/connection-explorer.html#case=2');
      assert.equal(new URL(page.url()).hash,'#case=2');
      assert.equal(await page.locator('#detail h2').textContent(),'Fixture investigation','baseline changes URL but retains the previous investigation');
      console.log('PASS: baseline fragment navigation reproduces a case URL/diagram mismatch without a hash listener.');
      ignoreHashNavigation=false;
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        await page.goto('https://classic.example/connection-explorer.html#case=1');await page.reload();
        await page.waitForFunction(()=>document.querySelector('#graph .node')?.getAttribute('aria-label')==='Fixture investigation');
        await page.locator('#newCase').click();await page.locator('#draftTitle').fill('Keep navigation draft');
        const saved=await page.evaluate(()=>localStorage.getItem('evidence-atlas-connection-drafts-v1')),requests=caseRequests;
        await page.locator('#graph .node').nth(1).press('Enter');
        await page.goto('https://classic.example/connection-explorer.html#case=2');
        await page.waitForFunction(()=>document.querySelector('#detail h2').textContent==='Related fixture investigation');
        assert.equal(await page.locator('#graph .node').first().getAttribute('aria-label'),'Related fixture investigation');
        assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true,'replaced explorer focus reaches the new heading');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#graph .node').first().evaluate(el=>el===document.activeElement),true);
        await page.goBack();
        await page.waitForFunction(()=>document.querySelector('#detail h2').textContent==='Fixture investigation');
        await page.goForward();
        await page.waitForFunction(()=>document.querySelector('#detail h2').textContent==='Related fixture investigation');
        assert.equal(await page.locator('#search-status').textContent(),'Opened investigation: Related fixture investigation · Case #2. Search again to find another case.');
        await page.locator('#draftTitle').click();
        await page.goto('https://classic.example/connection-explorer.html#case=1');
        await page.waitForFunction(()=>document.querySelector('#detail h2').textContent==='Fixture investigation');
        assert.equal(await page.locator('#draftTitle').evaluate(el=>el===document.activeElement),true,'navigation does not steal focus from draft editing');
        const view=await page.locator('#graph').getAttribute('viewBox');
        await page.goto('https://classic.example/connection-explorer.html#case=999999');
        await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('No published investigation matches'));
        assert.equal(await page.locator('#detail h2').textContent(),'Fixture investigation');
        assert.equal(await page.locator('#graph').getAttribute('viewBox'),view,'unknown case preserves the current graph');
        await page.goBack();
        await page.waitForFunction(()=>document.querySelector('#search-status').textContent.startsWith('Opened investigation: Fixture investigation · Case #1.'));
        assert.equal(await page.locator('#graph').getAttribute('viewBox'),view,'returning to the already open case preserves its view');
        assert.equal(await page.locator('#draftTitle').evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#draftTitle').inputValue(),'Keep navigation draft');
        assert.equal(await page.evaluate(()=>localStorage.getItem('evidence-atlas-connection-drafts-v1')),saved);
        assert.equal(caseRequests,requests,'same-document navigation does not reload public data');
        await page.locator('#cancelDraft').click();
      }
      console.log('PASS: hash links and browser Back/Forward restore the matching investigation at 320/768/1280px without data refetch or changing private drafts; explorer focus/Escape recover, draft focus is retained, and unknown case links are explained without fabricated records.');
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        await page.goto('https://classic.example/connection-explorer.html#case=1');
        await page.reload();
        await page.waitForFunction(()=>document.querySelector('#graph .node')?.getAttribute('aria-label')==='Fixture investigation');
        const oldSource=await page.locator('#graph .node').nth(1).elementHandle();
        await page.locator('#graph .node').nth(1).press('Enter');
        await page.keyboard.press('Tab');await page.keyboard.press('Tab');
        const related=page.getByRole('button',{name:'Related fixture investigation · Case #2',exact:true});
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
      assert.equal(await page.locator('#search-status').textContent(),'Type a title or case ID to search 2 published cases.');
      cases.push(...Array.from({length:20},(_,i)=>({id:i+3,title:'SearchMatch '+(i+1)})));
      await page.reload();await page.waitForFunction(()=>!document.querySelector('#search').disabled);
      assert.equal(await page.locator('#search').getAttribute('aria-describedby'),'searchHelp search-status');
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
        assert.equal(await page.locator('#search-status').textContent(),'No matching published cases. Try another title or case ID.');
        await page.locator('#search').fill('');
        assert.equal(await page.locator('#results button').count(),0);
        assert.equal(await page.locator('#search-status').textContent(),'Type a title or case ID to search 22 published cases.');
        assert.equal(await page.locator('#search').evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.locator('#detail h2').textContent(),caseTitle);
        assert.equal(new URL(page.url()).hash,caseHash,'query updates do not navigate');
      }
      await page.locator('#search').fill('SearchMatch 20');
      assert.equal(await page.locator('#search-status').textContent(),'1 matching published case.');
      await page.locator('#results button').press('Enter');
      assert.equal(new URL(page.url()).hash,'#case=22');
      assert.equal(await page.locator('#search-status').textContent(),'Opened investigation: SearchMatch 20 · Case #22. Search again to find another case.');
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
      const duplicateTitle='Duplicate investigation '+ 'x'.repeat(120);
      cases.push({id:23,title:duplicateTitle,summary:'First distinct record'}, {id:24,title:duplicateTitle,summary:'Second distinct record'});
      references.push({case_id:23,title:'First distinct source',url:'https://records.example/first'}, {case_id:24,title:'Second distinct source',url:'https://records.example/second'});
      await page.reload();await page.waitForFunction(()=>!document.querySelector('#search').disabled);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const [i,id,summary,source] of [[0,23,'First distinct record','First distinct source'],[1,24,'Second distinct record','Second distinct source']]) {
          await page.locator('#search').fill('Duplicate investigation');
          assert.equal(await page.locator('#results button').count(),2,'same-title records remain separate');
          const label=duplicateTitle+' · Case #'+id;
          const result=page.locator('#results').getByRole('button',{name:label,exact:true});
          assert.equal(await result.textContent(),label,'visible text and accessible name agree');
          assert.ok(await result.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),'long title plus ID wraps');
          await page.locator('#search').press('Tab');
          if(i)await page.keyboard.press('Tab');
          assert.equal(await result.evaluate(el=>el===document.activeElement),true);
          await page.keyboard.press(i?'Space':'Enter');
          await page.waitForFunction(id=>location.hash==='#case='+id,id);
          assert.equal(new URL(page.url()).hash,'#case='+id);
          assert.equal(await page.locator('#detail h2').textContent(),duplicateTitle);
          assert.equal(await page.locator('#detail p').textContent(),summary);
          assert.equal(await page.locator('#graph .node').nth(1).getAttribute('aria-label'),source);
          assert.equal(await page.locator('#search-status').textContent(),'Opened investigation: '+label+'. Search again to find another case.');
          assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
        }
      }
      console.log('PASS: same-title search results have distinct visible/accessibility case IDs, wrap long labels, and native Tab/Enter/Space open the exact record, summary, source and confirmation at 320/768/1280px without merging records.');
      // Equal titles in the source inspector must remain distinguishable, just like search results.
      const identityRefsStart=references.length;
      references.push({case_id:23,title:'Shared identity fixture',url:'https://records.example/identity'},
        {case_id:24,title:'Shared identity fixture',url:'https://records.example/identity'},
        {case_id:1,title:'Shared identity fixture',url:'https://records.example/identity'},
        {case_id:23,title:'Repeated shared reference',url:'https://records.example/identity'});
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const [id,summary,key] of [[23,'First distinct record','Enter'],[24,'Second distinct record','Space']]) {
          await page.goto('https://classic.example/connection-explorer.html#case=1');await page.reload();
          await page.waitForFunction(()=>document.querySelector('#graph .node')?.getAttribute('aria-label')==='Fixture investigation');
          await page.getByRole('button',{name:'Shared identity fixture',exact:true}).press('Enter');
          assert.equal(await page.locator('#detail li button').count(),2,'repeated citations do not duplicate related cases');
          for(const relatedId of [23,24]) {
            const label=duplicateTitle+' · Case #'+relatedId;
            const button=page.locator('#detail').getByRole('button',{name:label,exact:true});
            assert.equal(await button.textContent(),label,'visible label includes the same ID as the accessible name');
            assert.ok(await button.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),'long related-case label wraps');
          }
          const target=page.locator('#detail').getByRole('button',{name:duplicateTitle+' · Case #'+id,exact:true});
          await page.keyboard.press('Tab');await page.keyboard.press('Tab');
          if(id===24)await page.keyboard.press('Tab');
          assert.equal(await target.evaluate(el=>el===document.activeElement),true);
          await page.keyboard.press(key);
          await page.waitForFunction(id=>location.hash==='#case='+id,id);
          assert.equal(new URL(page.url()).hash,'#case='+id);
          assert.equal(await page.locator('#detail p').textContent(),summary);
          assert.equal(await page.locator('#detail h2').textContent(),duplicateTitle);
          assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#graph .node').first().evaluate(el=>el===document.activeElement),true);
        }
      }
      console.log('PASS: same-title related-case buttons expose distinct visible/accessibility IDs, deduplicate repeated citations, wrap at 320/768/1280px and native Tab/Enter/Space open the exact record with heading focus and Escape return.');
      references.splice(identityRefsStart);
      const longCaseTitle='Long investigation '+ 'X'.repeat(120),longSummary='Document identifier: '+ 'ABC123'.repeat(35);
      const longSourceTitle='Long source '+ 'Y'.repeat(120),longPublisher='Archive'+ 'Z'.repeat(100);
      cases.push({id:25,title:longCaseTitle,summary:longSummary});
      references.push({case_id:25,title:longSourceTitle,publisher:longPublisher,url:'https://records.example/long-record'});
      const pageWidth=()=>page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
      unwrappedDetails=true;await page.setViewportSize({width:320,height:900});
      await page.goto('https://classic.example/connection-explorer.html#case=25');await page.reload();
      await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===2);
      const before=await pageWidth();
      assert.ok(before.content>before.viewport,'unwrapped long inspector text reproduces page-wide overflow');
      console.log('PASS: unwrapped inspector baseline reproduces horizontal page overflow at 320px: '+before.content+'px content.');
      unwrappedDetails=false;
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});await page.reload();
        await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===2);
        await page.locator('#search').fill('Long investigation');
        await page.locator('#search').press('Tab');await page.keyboard.press('Enter');
        assert.equal(await page.locator('#detail h2').textContent(),longCaseTitle);
        assert.equal(await page.locator('#detail p').textContent(),longSummary);
        assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
        assert.ok(await page.locator('#detail').evaluate(el=>el.scrollWidth<=el.clientWidth),'complete case title and summary wrap without clipping');
        let size=await pageWidth();assert.ok(size.content<=size.viewport,'case selection confirmation fits the page');
        await page.keyboard.press('Escape');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
        assert.equal(await page.locator('#detail h2').textContent(),longSourceTitle);
        assert.ok((await page.locator('#detail p').first().textContent()).includes(longPublisher));
        assert.ok(await page.locator('#detail').evaluate(el=>el.scrollWidth<=el.clientWidth),'complete source title and publisher wrap');
        size=await pageWidth();assert.ok(size.content<=size.viewport,'source inspector fits the page');
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#detail a').evaluate(el=>el===document.activeElement),true,'source URL remains the next keyboard stop');
        assert.equal(await page.locator('#detail a').getAttribute('href'),'https://records.example/long-record');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#graph .node').nth(1).evaluate(el=>el===document.activeElement),true,'Escape returns to the source card');
      }
      console.log('PASS: long case/source headings, summaries, publishers and search confirmations reflow without page overflow at 320/768/1280px; full text, indexed URL, keyboard focus, Tab and Escape are preserved.');
      await page.goto('https://classic.example/connection-explorer.html#case=24');
      await page.waitForFunction(()=>document.querySelectorAll('#graph .node').length===2);
      const idSearchRequests=caseRequests;
      assert.equal(await page.locator('#searchHelp').textContent(),'Search by title or exact case ID, such as #42. From the diagram or details, Ctrl+K (Command+K on Mac) focuses search.');
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        assert.ok(await page.locator('#searchHelp').evaluate(el=>el.scrollWidth<=el.clientWidth&&el.getBoundingClientRect().right<=innerWidth),'persistent search instructions wrap');
        for(const query of ['24','#24','Case #24','case 24']) {
          await page.locator('#search').fill(query);
          const result=page.locator('#results').getByRole('button',{name:duplicateTitle+' · Case #24',exact:true});
          assert.equal(await page.locator('#results button').count(),1,'exact ID distinguishes equal-title records');
          assert.equal(await page.locator('#search-status').textContent(),'1 matching published case.');
          await page.locator('#search').press('Tab');
          assert.equal(await result.evaluate(el=>el===document.activeElement),true);
          await page.keyboard.press('Enter');
          await page.waitForFunction(()=>location.hash==='#case=24');
          assert.equal(await page.locator('#detail p').textContent(),'Second distinct record');
          assert.equal(await page.locator('#graph .node').nth(1).getAttribute('aria-label'),'Second distinct source');
          assert.equal(await page.locator('#detail h2').evaluate(el=>el===document.activeElement),true);
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#graph .node').first().evaluate(el=>el===document.activeElement),true);
        }
        await page.locator('#search').fill('#2');
        assert.equal(await page.locator('#results button').count(),1,'ID prefixes do not match unrelated IDs');
        assert.equal(await page.locator('#results button').textContent(),'Related fixture investigation · Case #2');
        await page.locator('#search').fill('#240');
        assert.equal(await page.locator('#results button').count(),0,'partial or unknown IDs do not fetch or fabricate a case');
        assert.equal(await page.locator('#search-status').textContent(),'No matching published cases. Try another title or case ID.');
        await page.locator('#search').fill('2');
        assert.equal(await page.locator('#results').getByRole('button',{name:'Related fixture investigation · Case #2',exact:true}).count(),1);
        assert.equal(await page.locator('#results').getByRole('button',{name:'SearchMatch 2 · Case #4',exact:true}).count(),1,'numeric text retains existing title matches');
        await page.locator('#search').fill('Duplicate investigation');
        assert.equal(await page.locator('#results button').count(),2,'title matching still keeps equal-title records separate');
        assert.equal(await page.locator('#detail p').textContent(),'Second distinct record','query changes do not navigate');
        assert.equal(new URL(page.url()).hash,'#case=24');
      }
      assert.equal(caseRequests,idSearchRequests,'ID queries only search the loaded public index');
      console.log('PASS: exact bare/#/Case-ID queries find and keyboard-open the correct equal-title record at 320/768/1280px with heading focus and Escape return; persistent instructions wrap, ID prefixes do not match other IDs, numeric title matches and existing title/selection behavior remain intact.');
      rejectCases=true;await page.reload();
      await page.waitForFunction(()=>document.querySelector('#search-status').textContent.includes('unavailable'));
      assert.equal(await page.locator('#search').isDisabled(),true);
      assert.equal(await page.locator('#search-status').textContent(),'Published case search is unavailable. Retry loading investigations.');
      assert.equal(await page.locator('#graph').evaluate(el=>{const event=new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true});el.dispatchEvent(event);return event.defaultPrevented}),false,'unavailable search shortcut is not intercepted');
      assert.equal(await page.locator('#results button').count(),0);
      assert.equal(await page.locator('#graph .node').count(),0,'failure does not fabricate records');
      assert.match(await page.locator('#status').textContent(),/Could not load the public investigation data/);
      assert.equal(await page.locator('#retryLoad').isVisible(),true);
      const failedRequests=caseRequests;
      await page.locator('#retryLoad').press('Enter');
      await page.waitForFunction(()=>document.querySelector('#retryLoad').getAttribute('aria-disabled')===null);
      assert.equal(caseRequests,failedRequests+1);
      assert.equal(await page.locator('#retryLoad').isVisible(),true,'failed retry remains actionable');
      assert.equal(await page.locator('#retryLoad').evaluate(el=>el===document.activeElement),true);
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        rejectCases=true;await page.reload();
        await page.waitForFunction(()=>document.querySelector('#retryLoad').hidden===false);
        await page.locator('#newCase').click();await page.locator('#draftTitle').fill('Preserve unfinished retry draft');
        const draftStorage=await page.evaluate(()=>localStorage.getItem('evidence-atlas-connection-drafts-v1'));
        rejectCases=false;pauseCases=true;
        const retryPaused=new Promise(resolve=>casesPaused=resolve),beforeRequests=caseRequests;
        await page.locator('#retryLoad').press('Enter');await retryPaused;
        assert.equal(await page.locator('#retryLoad').getAttribute('aria-disabled'),'true');
        assert.equal(await page.locator('#retryLoad').textContent(),'Retrying…');
        assert.equal(await page.locator('#retryLoad').evaluate(el=>el===document.activeElement),true);
        await page.keyboard.press('Enter');assert.equal(caseRequests,beforeRequests+1,'busy retries do not duplicate requests');
        pauseCases=false;releaseCases();
        await page.waitForFunction(()=>!document.querySelector('#search').disabled);
        assert.equal(await page.locator('#retryLoad').isVisible(),false);
        assert.equal(await page.locator('#search').evaluate(el=>el===document.activeElement),true);
        assert.equal(new URL(page.url()).hash,'#case=24');
        assert.equal(await page.locator('#graph .node').count(),2,'recovery restores actual indexed case/source only');
        assert.equal(await page.locator('#graph .node').nth(1).getAttribute('aria-label'),'Second distinct source');
        assert.equal(await page.locator('#draftTitle').inputValue(),'Preserve unfinished retry draft');
        assert.equal(await page.locator('#draftForm').isVisible(),true);
        assert.equal(await page.evaluate(()=>localStorage.getItem('evidence-atlas-connection-drafts-v1')),draftStorage);
        await page.locator('#cancelDraft').click();
      }
      console.log('PASS: failed retry remains actionable; native keyboard recovery, busy request guard and exact case/source restoration work at 320/768/1280px without page reload or changing unfinished/private draft storage.');
      await page.clock.install();
      for(const width of [320,768,1280]) {
        await page.setViewportSize({width,height:900});
        for(const stalled of ['cases','references']) {
          const failed=page.waitForEvent('requestfailed',{predicate:r=>stalled==='cases'?r.url().includes('/api/cases'):r.url().endsWith('/paper-trails-data.json')});
          let waiting;
          if(stalled==='cases'){pauseCases=true;waiting=new Promise(resolve=>casesPaused=resolve)}
          else{pauseRefs=true;waiting=new Promise(resolve=>refsPaused=resolve)}
          await page.reload();await waiting;
          await page.locator('#newCase').click();await page.locator('#draftTitle').fill('Keep stalled-load draft');
          const stored=await page.evaluate(()=>localStorage.getItem('evidence-atlas-connection-drafts-v1'));
          await page.clock.fastForward(15001);await failed;
          await page.waitForFunction(()=>!document.querySelector('#retryLoad').hidden);
          assert.match(await page.locator('#status').textContent(),/did not respond within 15 seconds/);
          assert.equal(await page.locator('#search').isDisabled(),true);
          assert.equal(await page.locator('#graph .node').count(),0,'timeout does not expose stale or invented records');
          assert.equal(await page.locator('#retryLoad').getAttribute('aria-disabled'),null,'timeout releases the in-flight guard');
          assert.equal(await page.locator('#draftTitle').inputValue(),'Keep stalled-load draft');
          assert.equal(await page.locator('#draftTitle').evaluate(el=>el===document.activeElement),true,'timeout does not steal focus from unfinished draft');
          if(stalled==='cases'){pauseCases=false;releaseCases()}
          else{pauseRefs=false;releaseRefs()}
          await page.locator('#retryLoad').press('Enter');
          await page.waitForFunction(()=>!document.querySelector('#search').disabled);
          assert.equal(await page.locator('#search').evaluate(el=>el===document.activeElement),true);
          assert.equal(new URL(page.url()).hash,'#case=24');
          assert.equal(await page.locator('#graph .node').count(),2);
          assert.equal(await page.locator('#graph .node').nth(1).getAttribute('aria-label'),'Second distinct source');
          assert.equal(await page.locator('#draftTitle').inputValue(),'Keep stalled-load draft');
          assert.equal(await page.evaluate(()=>localStorage.getItem('evidence-atlas-connection-drafts-v1')),stored);
          await page.clock.fastForward(15001);
          assert.equal(await page.locator('#search').isDisabled(),false,'completed attempt clears its deadline');
          assert.equal(await page.locator('#retryLoad').isVisible(),false);
          await page.locator('#cancelDraft').click();
        }
      }
      console.log('PASS: stalled case and citation requests abort after the 15-second deadline at 320/768/1280px (virtual browser clock), expose Retry without stale records, retain draft text/storage/focus, and native Enter restores the exact case/source with search focus; successful-load deadlines are cleared.');
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
  const touch=await browser.newPage({viewport:{width:320,height:900},hasTouch:true});
  const touchUnexpected=[],touchErrors=[];touch.on('pageerror',e=>touchErrors.push(e.message));
  await touch.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin==='https://classic.example'&&u.pathname==='/connection-explorer.html')return route.fulfill({contentType:'text/html',body:original});
    if(u.origin==='https://classic.example'&&u.pathname==='/paper-trails-data.json')return route.fulfill({json:{references:[]}});
    if(u.hostname==='nxlffnplqdobfqxogmxo.supabase.co'&&u.pathname==='/functions/v1/evidence-atlas/api/cases')return route.fulfill({json:[{id:1,title:'Touch fixture'}],headers:{'access-control-allow-origin':'*'}});
    if(u.pathname==='/favicon.ico')return route.fulfill({status:204});
    touchUnexpected.push(u.href);return route.abort();
  });
  await touch.goto('https://classic.example/connection-explorer.html');await touch.waitForFunction(()=>document.querySelectorAll('#graph .node').length===1);
  const touchCards=await touch.locator('#graph').innerHTML(),touchHash=new URL(touch.url()).hash;
  await touch.locator('#search').fill('Touch');await touch.getByRole('button',{name:'Clear search',exact:true}).tap();
  assert.equal(await touch.locator('#search').inputValue(),'');assert.equal(await touch.locator('#search').evaluate(el=>el===document.activeElement),true);assert.equal(await touch.locator('#graph').innerHTML(),touchCards);assert.equal(new URL(touch.url()).hash,touchHash);
  console.log('PASS: phone emulated touch Clear search resets input with focus return while preserving the current graph/case.');
  for(const [id,expected] of [['zoomIn','76 52 608 416'],['zoomOut','0 0 760 520'],['zoomIn','76 52 608 416'],['resetView','0 0 760 520']]) {
    await touch.locator('#'+id).tap();
    assert.equal(await touch.locator('#graph').getAttribute('viewBox'),expected,'touch '+id+' changes only the view');
    assert.equal(await touch.locator('#graph').innerHTML(),touchCards);assert.equal(new URL(touch.url()).hash,touchHash);
  }
  console.log('PASS: phone emulated touch activates enlarged Zoom in/out and Reset controls with exact view changes, retaining case identity and card coordinates/content.');
  await touch.locator('#graph').scrollIntoViewIfNeeded();
  const touchBox=await touch.locator('#graph').boundingBox(),tx=touchBox.x+12,ty=touchBox.y+12;
  const touchSession=await touch.context().newCDPSession(touch);
  const sendTouches=async(type,points)=>{await touchSession.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y}))});await touch.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))};
  await sendTouches('touchStart',[[1,tx,ty]]);
  await sendTouches('touchMove',[[1,tx+10,ty+5]]);
  const primaryView=(await touch.locator('#graph').getAttribute('viewBox')).split(' ').map(Number);
  assert.notEqual(primaryView[0],0,'single primary touch pans');
  await sendTouches('touchStart',[[1,tx+10,ty+5],[2,tx+60,ty+30]]);
  await sendTouches('touchMove',[[1,tx+10,ty+5],[2,tx+80,ty+40]]);
  assert.deepEqual((await touch.locator('#graph').getAttribute('viewBox')).split(' ').map(Number),primaryView,'second touch does not take over active pan');
  await sendTouches('touchMove',[[1,tx+20,ty+10],[2,tx+80,ty+40]]);
  const continued=(await touch.locator('#graph').getAttribute('viewBox')).split(' ').map(Number);
  assert.ok(Math.abs(continued[0]-2*primaryView[0])<1e-8,'original primary touch keeps its pan origin: '+JSON.stringify({primaryView,continued}));
  await sendTouches('touchEnd',[]);
  assert.equal(await touch.locator('#graph').innerHTML(),touchCards);assert.equal(new URL(touch.url()).hash,touchHash);
  await touch.locator('#resetView').tap();
  console.log('PASS: browser-injected primary touch pans; a second touch cannot take over and the original touch continues from its own origin, retaining evidence/case identity.');
  await touch.locator('#panTools summary').tap();
  for(const [id,x,y] of [['panRight',76,0],['panDown',76,52],['panLeft',0,52],['panUp',0,0]]) {
    await touch.locator('#'+id).tap();
    const v=(await touch.locator('#graph').getAttribute('viewBox')).split(' ').map(Number);
    assert.deepEqual(v,[x,y,760,520]);
  }
  await touch.locator('#panLeft').tap();await touch.locator('#resetView').tap();assert.equal(await touch.locator('#graph').getAttribute('viewBox'),'0 0 760 520');
  await touch.locator('#panTools summary').tap();assert.equal(await touch.locator('#panLeft').isVisible(),false);
  assert.deepEqual(touchUnexpected,[]);assert.deepEqual(touchErrors,[]);await touch.close();
  console.log('PASS: emulated touch taps open movement controls, pan in four directions without dragging, Reset and collapse at phone width; no production requests or page errors.');
  console.log('PASS: no uncaught page errors or requests outside intercepted public fixtures.');
} finally {await browser.close();}
