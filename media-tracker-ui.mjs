import {readMediaFeed,selectMedia} from './media-tracker.mjs';
// Never query pending/private Supabase records. Only a separately cleared, same-origin export may be consumed.
export function mountMediaTracker(document,{fetcher=globalThis.fetch,now=()=>new Date()}={}){
  const $=id=>document.getElementById(id);
  const form=$('media-search'),query=$('media-query'),country=$('media-country'),language=$('media-language'),outlet=$('media-outlet'),mapMode=$('media-map-mode'),headlines=$('media-headline-mode');
  const status=$('media-status'),detail=$('media-detail'),results=$('media-results'),clusters=$('media-clusters'),outlets=$('media-outlet-list');
  let feed=null,view=null,submitted='',generation=0,focusHandler=()=>{},viewHandler=()=>{};
  const mode=()=>mapMode.value;
  const make=(tag,content)=>{const el=document.createElement(tag);if(content!==undefined)el.textContent=content;return el;};
  const link=(url,label)=>{const el=make('a',label);el.href=url;el.target='_blank';el.rel='noopener noreferrer';return el;};
  const button=(label,fn)=>{const el=make('button',label);el.type='button';el.addEventListener('click',fn);return el;};
  const locFor=r=>mode()==='event'?r.event_location:r.publisher_location;
  const headline=r=>headlines.value==='translated'&&r.headline_translated?r.headline_translated:r.headline_original;
  const date=r=>r.published_at?r.published_at+' · Pacific day shown in tracker':'Publication timestamp unavailable';
  const toneCounts=c=>Object.entries(c.counts).filter(([,v])=>v).map(([k,v])=>k+': '+v).join(' · ');
  function closeDetail(){detail.hidden=true;detail.replaceChildren();}
  function article(r,full=false){
    const node=make('article');const heading=make('h4',headline(r));heading.lang=headlines.value==='translated'&&r.headline_translated?'':r.language;node.append(heading);
    node.append(make('p',[r.outlet,r.publisher_country||'Publisher country unavailable',r.language,date(r)].join(' · ')));
    node.append(make('p','Reporting tone: '+r.tone+' — '+r.tone_rationale));
    if(headlines.value==='translated'&&r.headline_translated)node.append(make('p','Original: '+r.headline_original+' · Translation: '+r.translation_attribution));
    const loc=locFor(r);
    node.append(make('p',loc?((mode()==='event'?'Event':'Publication')+' location: '+loc.label+' — '+loc.basis):'No sourced location in this map mode; no pin.'));
    if(full&&loc)node.append(link(loc.source_url,'Inspect location evidence (new tab)'),make('p','Displayed point: '+loc.lat+', '+loc.lon));
    node.append(link(r.original_url,'Original article — '+r.outlet+' (new tab)'),make('p',r.verification_label));
    if(full){node.append(link(r.attribution_url,'Attribution / content-use source (new tab)'));if(r.correction_url)node.append(link(r.correction_url,'Correction (new tab)'));}
    else node.append(button('Inspect story and focus map',()=>{showStories([r],'Selected story',loc);}));
    return node;
  }
  function showStories(stories,title,loc){
    detail.replaceChildren(make('h3',title),...stories.map(r=>article(r,true)),button('Close story details',()=>{closeDetail();query.focus();}));
    detail.hidden=false;detail.focus();if(loc&&mode()!=='reviewed')focusHandler(loc);
  }
  function inspectClusters(items){
    const unique=new Map();for(const cluster of items)for(const story of cluster.stories)unique.set(story.id,story);
    showStories([...unique.values()],items.length===1?'Reporting cluster · '+toneCounts(items[0]):'Overlapping reporting clusters',null);
  }
  function populate(select,values,all){
    const previous=select.value;select.replaceChildren();
    const first=make('option',all);first.value='';select.append(first);
    for(const value of [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b))){const option=make('option',value);option.value=value;select.append(option);}
    if([...select.options].some(o=>o.value===previous))select.value=previous;
  }
  function render(){
    closeDetail();results.replaceChildren();clusters.replaceChildren();outlets.replaceChildren();
    document.querySelector('.globe-area').dataset.mapMode=mode()==='reviewed'?'reviewed':'media';
    const tallies=[...document.querySelectorAll('.media-tallies [data-tone]')];
    if(!feed){view=null;for(const row of tallies)row.querySelector('strong').textContent='—';$('media-result-total').textContent='';viewHandler(null,mode());return;}
    view=selectMedia(feed,{query:submitted,country:country.value,language:language.value,outlet:outlet.value,mode:mode()==='event'?'event':'publisher',now:now()});
    for(const row of tallies)row.querySelector('strong').textContent=String(view.counts[row.dataset.tone]);
    status.textContent=(view.searching?'Search results across indexed dates':'Today: '+view.day+' (Pacific)')+' · '+view.reports.length+' indexed reports · '+view.unlocated.length+' without mapped location · '+view.undated.length+' without publication timestamp. Feed checked: '+feed.checked_at+'. '+feed.coverage_note;
    $('media-result-total').textContent='('+view.reports.length+')';
    for(const [name,count] of view.outlets)outlets.append(make('li',name+': '+count));
    for(const cluster of view.clusters){
      const item=make('li');const loc=locFor(cluster.stories[0]);
      item.append(button((loc?.label||'Mapped point')+' · '+toneCounts(cluster),()=>{inspectClusters([cluster]);if(mode()!=='reviewed')focusHandler(cluster);}));
      clusters.append(item);
    }
    const grouped=new Set();
    for(const [key,stories] of view.coverageGroups){
      const group=make('section');group.append(make('h3','Coverage: '+key));
      group.append(make('p','Compare attributed accounts; no claim-level conflict or corroboration is inferred.'));
      for(const r of stories){grouped.add(r.id);group.append(article(r));}results.append(group);
    }
    for(const r of view.reports)if(!grouped.has(r.id))results.append(article(r));
    if(!view.reports.length)results.append(make('p','No matching indexed reports in this limited feed; this is not evidence that no reports exist.'));
    viewHandler(view,mode());
  }
  async function refresh(){
    const request=++generation;feed=null;render();status.textContent='Loading public reporting feed; counts unavailable.';
    try{
      const response=await fetcher('./public-media-reports.json',{cache:'no-store',credentials:'omit',redirect:'error'});
      if(!response.ok)throw Error('Public media export unavailable');
      const next=readMediaFeed(await response.json());
      if(request!==generation)return;
      feed=next;populate(country,feed.reports.map(r=>r.publisher_country),'All countries');populate(language,feed.reports.map(r=>r.language),'All languages');populate(outlet,feed.reports.map(r=>r.outlet),'All outlets');render();
    }catch(error){if(request!==generation)return;feed=null;render();status.textContent='Public reporting feed unavailable. No global or outlet counts can be calculated. Private/pending review queues are not a fallback.';}
  }
  form.addEventListener('submit',e=>{e.preventDefault();submitted=query.value;render();$('media-results-panel').open=true;});
  for(const control of [country,language,outlet,mapMode,headlines])control.addEventListener('change',render);
  $('media-clear').addEventListener('click',()=>{query.value='';submitted='';country.value=language.value=outlet.value='';mapMode.value='publisher';render();focusHandler(null);query.focus();});
  $('media-refresh').addEventListener('click',refresh);
  // Re-fetch on returning to the page after a briefing window, without implying that a briefing itself populates the public export.
  let lastRefresh=Date.now();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefresh>15*60*1000){lastRefresh=Date.now();refresh();}});
  refresh();
  return {mode,available:()=>!!feed,inspectClusters,subscribe(fn){viewHandler=fn;fn(view,mode());},onFocus(fn){focusHandler=fn;}};
}
