import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {validatePublicMediaExport} from '../media-tracker.mjs';
import {readFileSync} from 'node:fs';
const base='http://127.0.0.1:8123';
const fixtureURL='https://example.invalid';
const date=new Date().toISOString();
const location={kind:'publisher',lat:0,lon:-90,label:'Synthetic fixture point',basis:'Browser test only; not evidence',source_url:fixtureURL+'/place',review_status:'verified'};
const story=(id,extra={})=>({id,original_url:fixtureURL+'/'+id,outlet:'Fixture outlet A',headline_original:'Synthetic water story '+id,language:'en',publisher_country:'Fixture country',attribution_url:fixtureURL+'/terms',publication_status:'published',editorial_status:'cleared_for_public_index',published_at:date,tone:'positive',tone_rationale:'Synthetic only',coverage_group:'water',publisher_location:location,...extra});
const feed={schema_version:1,kind:'public_media_reports',checked_at:date,coverage_note:'Synthetic browser fixture, not live data',reports:[story('a',{publication_time_source_url:fixtureURL+'/rss?edition=local#entry'}),story('b',{tone:'negative',outlet:'Fixture outlet B',language:'es',headline_original:'Agua',headline_translated:'Water',translation_attribution:'Synthetic translation'}),story('c',{tone:'neutral',publisher_location:null}),story('old',{published_at:null,published_date_reported:'2000-01-01',tone:'uncertain',publisher_location:null})]};
// Structural preflight checks before launching the browser.
assert.equal(validatePublicMediaExport(feed).reports[0].publication_time_source_url,fixtureURL+'/rss?edition=local#entry');
assert.equal(validatePublicMediaExport(feed).reports[1].publication_time_source_url,null);
for(const invalid of ['http://example.invalid/feed','https://user:pass@example.invalid/feed','javascript:alert(1)',42])
 assert.throws(()=>validatePublicMediaExport({...feed,reports:[story('bad',{publication_time_source_url:invalid})]}));
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}:{viewport:{width:1360,height:900}});
  const page=await context.newPage();let unavailable=false,invalid=false,stale=false;
  await page.route('**/*',async route=>{
    const url=route.request().url();
    if(url===base+'/public-media-reports.json')return route.fulfill({status:unavailable?503:200,contentType:'application/json',body:JSON.stringify(invalid?{...feed,reports:[...feed.reports,story('d',{editorial_status:'pending',headline_original:'Private fixture never visible'})]}:stale?{...feed,checked_at:'2000-01-01T00:00:00Z'}:feed)});
    if(url.includes('cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js'))return route.fulfill({status:200,contentType:'application/javascript',headers:{'access-control-allow-origin':'*'},body:readFileSync('node_modules/three/build/three.module.js','utf8')});
    if(url.startsWith(base+'/'))return route.continue();
    return route.abort();
  });
  await page.goto(base+'/index.html');
  if(await page.locator('#ea-opening-skip').isVisible())await page.locator('#ea-opening-skip').click();
  await page.locator('#media-status').filter({hasText:'3 indexed reports'}).waitFor();
  assert.match(await page.locator('#media-status').textContent(),/Feed freshness: Checked in latest briefing window/);
  assert.equal(await page.locator('[data-tone="positive"] strong').textContent(),'1');
  assert.equal(await page.locator('[data-tone="negative"] strong').textContent(),'1');
  assert.equal(await page.locator('[data-tone="neutral"] strong').textContent(),'1');
  assert.equal(await page.locator('#media-map-mode').inputValue(),'publisher');
  assert.equal(await page.locator('#earth').evaluate(e=>getComputedStyle(e).touchAction),'pan-y');
  assert.equal(await page.locator('#media-results').getByText('Private fixture never visible').count(),0);
  await page.locator('#media-location-list summary').click();
  const cluster=page.locator('#media-clusters button');assert.equal(await cluster.count(),1);
  if(mobile)await cluster.tap();else{await cluster.focus();await page.keyboard.press('Enter');}
  await page.locator('#media-detail').filter({hasText:'Reporting cluster'}).waitFor();
  assert.match(await page.locator('#media-detail').textContent(),/positive: 1 · negative: 1/);
  assert.equal(await page.locator('#media-detail a').filter({hasText:'Original article'}).count(),2);
  assert.equal(await page.locator('#media-detail a').filter({hasText:'Inspect publication date/time source'}).getAttribute('href'),fixtureURL+'/rss?edition=local#entry');
  assert.match(await page.locator('#media-detail').textContent(),/Separate publication date\/time citation not supplied/);
  await page.locator('#media-detail button').click();
  await page.locator('#media-query').fill('Agua');await page.locator('#media-query').press('Enter');
  await page.locator('#media-status').filter({hasText:'1 indexed reports'}).waitFor();
  await page.locator('#media-headline-mode').selectOption('translated');
  assert.match(await page.locator('#media-results').textContent(),/Synthetic translation/);
  await page.locator('#media-map-mode').selectOption('event');
  assert.equal(await page.locator('#media-clusters button').count(),0);
  await page.locator('#media-clear').click();
  await page.locator('#media-status').filter({hasText:'3 indexed reports'}).waitFor();
  assert.equal(await page.locator('#media-map-mode').inputValue(),'publisher');
  await page.locator('#media-query').fill('2000-01-01');await page.locator('#media-query').press('Enter');
  await page.locator('#media-status').filter({hasText:'1 publisher-date-only'}).waitFor();
  assert.match(await page.locator('#media-results').textContent(),/Publisher-reported date: 2000-01-01/);
  assert.match(await page.locator('#media-results').textContent(),/not counted in Pacific daily totals/);
  assert.equal(await page.locator('#media-clusters button').count(),0);
  await page.locator('#media-clear').click();
  await page.locator('#media-status').filter({hasText:'3 indexed reports'}).waitFor();
  stale=true;await page.locator('#media-refresh').click();
  await page.locator('#media-status').filter({hasText:'Not checked since latest briefing window'}).waitFor();
  assert.equal(await page.locator('[data-tone="positive"] strong').textContent(),'1');
  stale=false;await page.locator('#media-refresh').click();
  await page.locator('#media-status').filter({hasText:'Checked in latest briefing window'}).waitFor();
  invalid=true;await page.locator('#media-refresh').click();
  await page.locator('#media-status').filter({hasText:'Public reporting feed unavailable'}).waitFor();
  assert.equal(await page.locator('[data-tone="positive"] strong').textContent(),'—');
  assert.equal(await page.locator('#media-clusters button').count(),0);
  assert.equal(await page.locator('#media-results article').count(),0);
  assert.equal(await page.locator('#media-results').getByText('Private fixture never visible').count(),0);
  invalid=false;await page.locator('#media-refresh').click();
  await page.locator('#media-status').filter({hasText:'3 indexed reports'}).waitFor();
  unavailable=true;await page.locator('#media-refresh').click();
  await page.locator('#media-status').filter({hasText:'Public reporting feed unavailable'}).waitFor();
  assert.equal(await page.locator('[data-tone="positive"] strong').textContent(),'—');
  assert.equal(await page.locator('#media-clusters button').count(),0);
  await context.close();
 }
 console.log('Desktop keyboard and mobile touch browser fixture checks passed.');
}finally{await browser.close();}
