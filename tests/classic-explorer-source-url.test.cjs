const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const html=readFileSync(require('node:path').join(__dirname,'../connection-explorer.html'),'utf8');
const start=html.indexOf('function safeSourceUrl('),end=html.indexOf('function svg(',start);
assert.ok(start>=0&&end>start);
function fixture(){
  const panel={children:[]};
  const el=(tag,text,parent)=>{const n={tag,textContent:text,children:[]};parent?.children.push(n);return n};
  const scope=vm.runInNewContext(html.slice(start,end)+';({safeSourceUrl,detail})',{
    URL,$:()=>panel,el,clear:p=>p.children=[]});
  return {...scope,panel};
}
test('classic citation URL validation preserves exact query and fragment distinctions',()=>{
  const {safeSourceUrl}=fixture();
  for(const url of ['https://records.example/doc?id=1#page=2','https://records.example/doc?id=1#page=3','http://records.example/doc/'])assert.equal(safeSourceUrl(url),url);
});
test('classic citation URL validation withholds unsafe, relative and credential-bearing destinations',()=>{
  const {safeSourceUrl}=fixture();
  for(const url of ['javascript:alert(1)','data:text/html,test','file:///test','/relative','not a URL','https://user:password@records.example/doc','https://records.example@other.example/doc',null,''])assert.equal(safeSourceUrl(url),null,String(url));
});
test('classic inspector exposes validated full destination and new-tab scope without authenticating sources',()=>{
  const {detail,panel}=fixture(),url='https://records.example/doc?id=42#page=7';
  detail('Citation','Metadata, not verification',url);
  assert.equal(panel.children[2].textContent,'Indexed URL: '+url);
  const link=panel.children[3];assert.equal(link.href,url);assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');
  assert.match(link.textContent,/records.example.*opens in new tab/);assert.doesNotMatch(link.textContent,/original document/i);
  detail('Unsafe citation','Metadata','javascript:alert(1)');
  assert.ok(!panel.children.some(n=>n.tag==='a'));assert.match(panel.children[2].textContent,/No safe HTTP\(S\) destination/);
  detail('Case','Summary');assert.equal(panel.children.length,2);
});
