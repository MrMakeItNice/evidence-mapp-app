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
