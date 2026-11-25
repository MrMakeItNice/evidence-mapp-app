const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('research-quality.html','utf8');
const script=html.split('<script>')[1]?.split('</script>')[0];
if(!script)throw Error('Research Quality inline script missing');
new vm.Script(script,{filename:'research-quality.html'});
assert.match(html,/<input id="q"[^>]*disabled>/);
assert.match(html,/<select id="filter"[^>]*disabled>/);
assert.match(html,/<button id="retry" type="button" hidden>/);

function boot(fetchImpl){
  const elements=new Map();
  const document={activeElement:null};
  const el=id=>{
    if(!elements.has(id))elements.set(id,{
      value:id==='filter'?'all':'',
      hidden:id==='retry',disabled:id==='q'||id==='filter',
      textContent:'',innerHTML:'',events:{},focused:false,attributes:{},
      focus(){this.focused=true;document.activeElement=this},
      setAttribute(name,value){this.attributes[name]=String(value)},
      removeAttribute(name){delete this.attributes[name]},
      addEventListener(name,fn){this.events[name]=fn}
    });
    return elements.get(id);
  };
  document.getElementById=el;
  vm.runInNewContext(script,{
    document,
    fetch:fetchImpl,AbortController,setTimeout,clearTimeout,encodeURIComponent
  },{timeout:1500});
  return el;
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('failed case-index request offers retry without fabricating quality metrics',async()=>{
  let requests=0;
  const el=boot(async()=>{
    requests++;
    if(requests===1)throw Error('offline');
    return {ok:true,json:async()=>[
      {id:7,title:'Documented case',case_number:2,summary:'Source context',official_finding:'Agency finding',start_date:'1975-01-02'},
      {id:8,title:'Another case',case_number:3}
    ]};
  });
  await flush();
  assert.equal(requests,1);
  assert.equal(el('q').disabled,true);
  assert.equal(el('filter').disabled,true);
  assert.equal(el('retry').hidden,false);
  assert.match(el('status').textContent,/cannot be loaded/);
  assert.equal(el('casesN').textContent,'');
  el('retry').focus();
  await el('retry').events.click();
  assert.equal(requests,2);
  assert.equal(el('retry').hidden,true);
  assert.equal(el('q').disabled,false);
  assert.equal(el('filter').disabled,false);
  assert.equal(el('casesN').textContent,2);
  assert.equal(el('q').focused,true,'successful retry restores focus to case search');
  assert.equal(el('officialN').textContent,1);
  assert.match(el('status').textContent,/2 of 2 matching published cases/);
});

test('normal success keeps retry hidden and allows filtering',async()=>{
  const el=boot(async()=>({ok:true,json:async()=>[{id:4,title:'Case with gap',case_number:1}]}));
  await flush();
  assert.equal(el('retry').hidden,true);
  assert.equal(el('casesN').textContent,1);
  assert.equal(el('q').disabled,false);
  assert.equal(el('q').focused,false,'initial success must not unexpectedly move focus');
  el('filter').value='official_missing';
  el('filter').events.change();
  assert.match(el('status').textContent,/1 of 1 matching published cases/);
});

test('invalid response never activates a misleading empty case browser',async()=>{
  const el=boot(async()=>({ok:true,json:async()=>({message:'not a case list'})}));
  await flush();
  assert.equal(el('retry').hidden,false);
  assert.equal(el('q').disabled,true);
  assert.equal(el('filter').disabled,true);
  assert.equal(el('casesN').textContent,'');
});


test('failed retry leaves focus on visible retry control until a successful reload',async()=>{
  let attempts=0;
  const el=boot(async()=>{
    attempts++;
    if(attempts<3)throw Error('temporary outage');
    return {ok:true,json:async()=>[{id:21,title:'Recovered case',case_number:21}]};
  });
  await flush();
  assert.equal(el('retry').hidden,false);
  el('retry').focus();
  await el('retry').events.click();
  assert.equal(el('retry').hidden,false);
  assert.equal(el('retry').focused,true,'failed retry leaves the keyboard target available');
  assert.equal(el('retry').attributes['aria-disabled'],undefined);
  assert.equal(el('q').focused,false,'failed retry should not jump to unavailable search');
  await el('retry').events.click();
  assert.equal(el('retry').hidden,true);
  assert.equal(el('q').focused,true);
  assert.equal(attempts,3);
});

test('in-flight retry stays focusable without duplicate requests or focus theft',async()=>{
  let attempts=0,resolveRetry;
  const el=boot(async()=>{
    attempts++;
    if(attempts===1)throw Error('offline');
    return new Promise(resolve=>{resolveRetry=resolve});
  });
  await flush();
  el('retry').focus();
  const pending=el('retry').events.click();
  assert.equal(el('retry').hidden,false,'a retry must not remove the focused control while loading');
  assert.equal(el('retry').attributes['aria-disabled'],'true');
  assert.equal(el('retry').textContent,'Loading cases…');
  await el('retry').events.click();
  assert.equal(attempts,2,'a second click must not start another fetch');
  el('other').focus();
  resolveRetry({ok:true,json:async()=>[{id:9,title:'Reviewed case',case_number:9}]});
  await pending;
  assert.equal(el('retry').hidden,true);
  assert.equal(el('retry').attributes['aria-disabled'],undefined);
  assert.equal(el('q').disabled,false);
  assert.equal(el('q').focused,false,'finishing a retry must not steal focus from a new target');
});
