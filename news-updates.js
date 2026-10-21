(function atlasNewsUpdates(){
  'use strict';
  const base='https://nxlffnplqdobfqxogmxo.supabase.co/rest/v1/';
  const key='sb_publishable_cZZLI1DFQBybPEvr8zA0_Q_jz8afL0i';
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe=u=>{try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:null}catch{return null}};
  const link=(u,text)=>safe(u)?'<a href="'+escape(safe(u))+'" target="_blank" rel="noopener noreferrer">'+escape(text)+' ↗</a>':escape(text);
  let articles=[],connections=[],catalog=[],loaded=false,failed=false;
  const host=document.getElementById('updatesGrid');
  if(!host)return;
  const status=document.getElementById('updatesStatus');
  const search=document.getElementById('updatesSearch');
  const category=document.getElementById('updatesCategory');
  const related=document.getElementById('updatesLinked');
  const casePane=document.getElementById('caseDetail');
  function relations(a){return connections.filter(c=>String(c.article_id)===String(a.id));}
  function card(a,compact=false){
    const d=a.frame_signals||{},links=relations(a),sources=Array.isArray(d.sources)?d.sources:[];
    const caseLinks=links.map(c=>{
      const file=catalog.find(x=>String(x.id)===String(c.case_id));
      return '<li><a href="./discover.html?case='+encodeURIComponent(c.case_id)+'#history">'+escape(file?'Case #'+file.case_number+' · '+file.title:'Open related case')+'</a><p>'+escape(c.explanation)+'</p><small>'+escape(c.connection_type.replaceAll('_',' '))+' · AI-suggested connection</small></li>';
    }).join('');
    return '<article class="newsitem update-card" id="'+(compact?'case-':'')+'update-'+a.id+'"><div class="eyebrow">'+escape(d.category||'News update')+' · Event '+escape(d.event_date||'date unavailable')+'</div><h3>'+escape(a.title)+'</h3><p><strong>'+escape(d.stage||'Assessment pending')+'</strong></p><p>'+escape(d.summary||'')+'</p><p><strong>Why it matters:</strong> '+escape(d.why||'')+'</p><details><summary>Evidence, limits & sources</summary><p>'+escape(d.limits||'')+'</p><p><strong>Coverage check:</strong> '+escape(d.coverage||'No comparison recorded.')+'</p><ul>'+sources.map(s=>'<li>'+link(s.url,s.label)+(s.author?' · '+escape(s.author):'')+' <small>('+escape(s.type||'source')+')</small></li>').join('')+'</ul><p class="feed-note">AI-assisted source check · '+escape(d.reviewed_at||'Date unavailable')+'. Human review not attested.</p></details>'+(caseLinks?'<details><summary>'+links.length+' related case'+(links.length===1?'':'s')+'</summary><ul>'+caseLinks+'</ul><p class="feed-note">The explanation describes the connection; topic overlap alone does not establish causation or a shared operation.</p></details>':'<p class="feed-note">No specific historical case connection recorded.</p>')+'</article>';
  }
  function render(){
    const q=search.value.trim().toLowerCase();
    const visible=articles.filter(a=>{const d=a.frame_signals||{};return (!category.value||d.category===category.value)&&(!related.checked||relations(a).length)&&(!q||[a.title,d.summary,d.stage,d.limits,d.coverage,...relations(a).map(c=>c.explanation)].join(' ').toLowerCase().includes(q));});
    status.textContent=failed?'Updates unavailable right now. Use Refresh to reconnect.':loaded?visible.length+' of '+articles.length+' saved updates · '+connections.length+' explained case connections':'Loading saved updates…';
    host.innerHTML=visible.length?visible.map(a=>card(a)).join(''):loaded?'<p class="message">No saved updates match these filters.</p>':failed?'<p class="message">The saved news feed could not be reached.</p>':'';
    const id=new URLSearchParams(location.search).get('update');
    if(id&&loaded&&!render.scrolled){const node=document.getElementById('update-'+id);if(node){render.scrolled=true;node.scrollIntoView({block:'start'});}}
    renderCaseNews();
  }
  function renderCaseNews(){
    if(!casePane||!loaded||casePane.hidden||!casePane.querySelector('#closeCase'))return;
    const id=casePane.dataset.caseId;if(!id)return;
    let section=casePane.querySelector('#caseNewsUpdates');
    if(section?.dataset.caseId===id)return;
    section?.remove();
    const matches=articles.filter(a=>relations(a).some(c=>String(c.case_id)===id));if(!matches.length)return;
    section=document.createElement('section');section.id='caseNewsUpdates';section.dataset.caseId=id;
    section.innerHTML='<h3>News connected to this file</h3><p class="feed-note">Each connection below explains its scope. Read the original sources alongside the historical dossier.</p>'+matches.map(a=>card(a,true)).join('');
    casePane.append(section);
  }
  async function read(path){const r=await fetch(base+path,{headers:{apikey:key},signal:AbortSignal.timeout(15000),cache:'no-store'});if(!r.ok)throw Error('News request failed');return r.json();}
  async function load(){
    const button=document.getElementById('updatesRefresh');button.disabled=true;failed=false;status.textContent='Refreshing saved updates…';
    try{
      const result=await Promise.all([read('news_articles?published=eq.true&review_status=neq.rejected&select=id,title,frame_signals,collected_at&order=first_seen_at.desc,id.desc&limit=500'),read('news_historical_connections?review_status=neq.rejected&select=article_id,case_id,connection_type,explanation&limit=2000'),fetch('https://nxlffnplqdobfqxogmxo.supabase.co/functions/v1/evidence-atlas/api/cases',{signal:AbortSignal.timeout(15000)}).then(r=>r.ok?r.json():[]).catch(()=>[])]);
      articles=result[0];connections=result[1];catalog=Array.isArray(result[2])?result[2]:[];loaded=true;
      casePane?.querySelector('#caseNewsUpdates')?.remove();render();
    }catch{failed=true;render();}finally{button.disabled=false;}
  }
  search.addEventListener('input',render);category.addEventListener('change',render);related.addEventListener('change',render);
  document.getElementById('updatesRefresh').addEventListener('click',load);
  if(casePane)new MutationObserver(renderCaseNews).observe(casePane,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
  load();
})();
