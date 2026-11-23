const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const html=readFileSync(join(__dirname,'..','investigation-reader.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function render(search){
  const nodes=new Map();let focusCalls=0;
  const element=tag=>({tag,textContent:'',children:[],attributes:{},append(...nodes){this.children.push(...nodes)},setAttribute(k,v){this.attributes[k]=v},focus(){focusCalls++}});
  const get=id=>{if(!nodes.has(id))nodes.set(id,element('div'));return nodes.get(id)};
  const document={title:'The Evidence · Investigation Reader',getElementById:get,createElement:element};
  new Function('document','location','URLSearchParams',script)(document,{search},URLSearchParams);
  const article=get('article'),heading=article.children.find(n=>n.tag==='h2');
  const notice=article.children.find(n=>n.id==='story-unavailable');
  const current=get('issue-links').children.filter(n=>n.attributes['aria-current']==='page');
  return {document,article,heading,notice,current,focusCalls};
}

test('known stories and default entry keep tab, headline and current issue selection aligned',()=>{
  for(const [search,title] of [['','Empires rise. Empires fall. What repeats?'],['?story=','Empires rise. Empires fall. What repeats?'],['?story=history','Empires rise. Empires fall. What repeats?'],['?story=money','Who funds what—and who benefits?'],['?story=mind','Mind, matter & meaning.']]){
    const page=render(search);
    assert.equal(page.document.title,title+' · The Evidence');assert.equal(page.heading.textContent,title);
    assert.equal(page.article.attributes['aria-labelledby'],page.heading.id);
    assert.equal(page.current.length,1);assert.equal(page.current[0].children[1].textContent,title);
    assert.equal(page.notice,undefined);assert.equal(page.focusCalls,0);
  }
});

test('an unknown story explains the fallback and provides an issue-menu recovery link',()=>{
  const page=render('?story=missing');
  assert.ok(page.notice,'the unresolved bookmark must not silently open a different story');
  assert.match(page.notice.textContent,/requested story is unavailable.*front-page explainer/);
  assert.equal(page.notice.attributes.role,'status');
  assert.equal(page.notice.children[0].href,'#inside-this-issue');
  assert.equal(page.notice.children[0].textContent,'Choose another story');
  assert.equal(page.heading.textContent,'Empires rise. Empires fall. What repeats?');
  assert.equal(page.document.title,page.heading.textContent+' · The Evidence');
  assert.equal(page.current.length,1);assert.equal(page.current[0].children[1].textContent,page.heading.textContent);
  assert.equal(page.focusCalls,0);
});

test('prototype keys and markup-like story values remain unavailable without echoing raw query text',()=>{
  for(const value of ['__proto__','constructor','toString','<script>alert(1)</script>']){
    const page=render('?story='+encodeURIComponent(value));
    assert.ok(page.notice);assert.equal(page.current.length,1);
    assert.doesNotMatch(page.notice.textContent,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.equal(page.notice.children.length,1);assert.equal(page.focusCalls,0);
  }
});

test('the recovery fragment resolves to a unique named, focusable issue menu',()=>{
  assert.equal([...html.matchAll(/id="inside-this-issue"/g)].length,1);
  assert.match(html,/<nav id="inside-this-issue" aria-labelledby="issue-heading" tabindex="-1">/);
  assert.match(html,/#inside-this-issue:focus-visible\{outline:3px solid var\(--red\)/);
});

test('issue links preserve each story query and target its focusable article on the destination page',()=>{
  for(const search of ['', '?story=money', '?story=missing']){
    const page=render(search);
    const links=page.document.getElementById('issue-links').children;
    assert.equal(links.length,3);
    for(const [index,id] of ['history','money','mind'].entries()){
      const link=links[index],url=new URL(link.href,'https://atlas.example/investigation-reader.html'+search);
      assert.equal(url.pathname,'/investigation-reader.html');
      assert.equal(url.searchParams.get('story'),id);assert.equal(url.hash,'#article');
      const destination=render(url.search);
      assert.equal(destination.heading.textContent,link.children[1].textContent);
      assert.equal(destination.notice,undefined);assert.equal(destination.current.length,1);
      assert.equal(destination.focusCalls,0,'native fragment navigation does not need scripted initial focus');
    }
  }
  assert.equal([...html.matchAll(/id="article"/g)].length,1);
  assert.match(html,/<article class="article" id="article" tabindex="-1"/);
  assert.match(html,/\.article:focus-visible\{outline:3px solid var\(--red\)/);
});

test('editorial source limitations are visible and described without relabeling navigation as evidence',()=>{
  assert.match(html,/<article\b[^>]*aria-describedby="article-source-status"/);
  assert.match(html,/research pathways in this edition link to related Evidence Atlas pages, not original source documents/i);
  const routes=[
    ['', ['./shared-future.html#history','./discover.html']],
    ['?story=', ['./shared-future.html#history','./discover.html']],
    ['?story=history', ['./shared-future.html#history','./discover.html']],
    ['?story=money', ['./paper-trails.html','./connection-explorer.html']],
    ['?story=mind', ['./shared-future.html#standards','./shared-future.html']],
    ['?story=missing', ['./shared-future.html#history','./discover.html']],
    ['?story=__proto__', ['./shared-future.html#history','./discover.html']]
  ];
  for(const [search,expected] of routes){
    const page=render(search),children=page.article.children;
    const notes=children.filter(n=>n.id==='article-source-status');
    assert.equal(notes.length,1);assert.equal(notes[0].attributes.role,'note');
    assert.match(notes[0].textContent,/Editorial overview.*No original documents are cited/);
    assert.ok(!('tabindex' in notes[0].attributes));
    assert.equal(children[children.findIndex(n=>n.className==='byline')+1],notes[0]);
    const index=children.findIndex(n=>n.tag==='h3'&&n.textContent==='Research pathways (not source citations)');
    assert.ok(index>=0);assert.equal(children[index+1].tag,'ul');
    assert.deepEqual(children[index+1].children.map(n=>n.children[0].href),expected);
    assert.equal(page.current.length,1);assert.match(page.current[0].href,/#article$/);
    assert.equal(page.focusCalls,0);
  }
});
