// Public media-index contract. NOT the reviewed-investigation event feed.
// Only consume a separately approved, allowlisted public export; never the pending DB queue.
const TONES = ['positive','negative','neutral','mixed','uncertain'];
const clean = v => typeof v === 'string' ? v.trim() : '';
function https(v) {
  try { const u = new URL(v); return typeof v === 'string' && u.protocol === 'https:' && !u.username && !u.password ? v : null; }
  catch { return null; }
}
function reportedDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v+'T00:00:00Z');
  return Number.isFinite(+d) && d.toISOString().slice(0,10)===v ? v : null;
}
function timestamp(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return null;
  const day = v.slice(0,10), d = new Date(day+'T00:00:00Z');
  if (!Number.isFinite(+d) || d.toISOString().slice(0,10)!==day || +v.slice(11,13)>23 || +v.slice(14,16)>59 || +v.slice(17,19)>59) return null;
  return Number.isFinite(Date.parse(v)) ? v : null;
}
export function pacificDay(v) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(v));
  const get = type => parts.find(p=>p.type===type).value;
  return get('year')+'-'+get('month')+'-'+get('day');
}
function location(v,kind) {
  if (!v || v.review_status!=='verified' || v.kind!==kind ||
      !Number.isFinite(v.lat) || Math.abs(v.lat)>90 || !Number.isFinite(v.lon) || Math.abs(v.lon)>180 ||
      !https(v.source_url) || !clean(v.basis) || !clean(v.label)) return null;
  return {kind,lat:v.lat,lon:v.lon,label:clean(v.label),basis:clean(v.basis),source_url:v.source_url};
}
export function readMediaFeed(feed) {
  if (!feed || feed.schema_version!==1 || feed.kind!=='public_media_reports' || !Array.isArray(feed.reports) ||
      !timestamp(feed.checked_at) || !clean(feed.coverage_note)) throw new Error('Media feed unavailable or invalid');
  const reports=[], ids=new Map(), urls=new Map();
  for (const r of feed.reports) {
    if (!r || r.publication_status!=='published' || r.editorial_status!=='cleared_for_public_index') continue;
    const id=clean(r.id), url=https(r.original_url), outlet=clean(r.outlet), headline=clean(r.headline_original);
    if (!id || !url || !outlet || !headline || !clean(r.language) || !https(r.attribution_url)) throw new Error('Invalid public media record');
    // Exact article identity only. Never deduplicate merely because two articles cover the same topic.
    const identity=JSON.stringify([url,outlet,headline,clean(r.language)]);
    if ((ids.has(id)&&ids.get(id)!==identity)||(urls.has(url)&&urls.get(url)!==identity)) throw new Error('Conflicting public media identity');
    if(ids.has(id)||urls.has(url)) { ids.set(id,identity); urls.set(url,identity); continue; }
    ids.set(id,identity); urls.set(url,identity);
    const rationale=clean(r.tone_rationale);
    const tone=TONES.includes(r.tone)&&rationale ? r.tone : 'uncertain';
    const translated=clean(r.headline_translated)&&clean(r.translation_attribution);
    reports.push({id,original_url:url,outlet,headline_original:headline,language:clean(r.language),
      attribution_url:r.attribution_url,author:clean(r.author),publisher_country:clean(r.publisher_country),
      published_at:timestamp(r.published_at),published_date_reported:reportedDate(r.published_date_reported),tone,tone_rationale:rationale||'Not yet classified',
      headline_translated:translated?clean(r.headline_translated):'',translation_attribution:translated?clean(r.translation_attribution):'',
      topics:Array.isArray(r.topics)?r.topics.filter(x=>typeof x==='string').map(clean).filter(Boolean):[],
      coverage_group:clean(r.coverage_group),syndication_id:clean(r.syndication_id),correction_url:https(r.correction_url),
      publisher_location:location(r.publisher_location,'publisher'),event_location:location(r.event_location,'event'),
      verification_label:'Attributed reporting, not independent verification'});
  }
  return {checked_at:feed.checked_at,coverage_note:clean(feed.coverage_note),reports};
}
function fold(v){return String(v??'').normalize('NFKC').toLocaleLowerCase().trim();}
export function selectMedia(feed,{query='',country='',language='',outlet='',now=new Date(),mode='publisher'}={}) {
  if (!['publisher','event'].includes(mode)) throw new Error('Invalid location mode');
  const day=pacificDay(now), terms=fold(query).split(/\s+/u).filter(Boolean);
  const searching=terms.length>0||!!country||!!language||!!outlet;
  const reports=feed.reports.filter(r=>{
    if(!searching&&(!r.published_at||pacificDay(r.published_at)!==day)) return false;
    if(country&&fold(r.publisher_country)!==fold(country)||language&&fold(r.language)!==fold(language)||outlet&&fold(r.outlet)!==fold(outlet)) return false;
    const hay=fold([r.headline_original,r.headline_translated,r.outlet,r.publisher_country,r.language,r.published_at,
      r.published_at?pacificDay(r.published_at):'',r.published_date_reported,r.publisher_location?.label,r.event_location?.label,...r.topics].join(' '));
    return terms.every(t=>hay.includes(t));
  });
  const counts=Object.fromEntries(TONES.map(t=>[t,0])),outlets=new Map(),clusters=new Map(),groups=new Map();
  for(const r of reports){
    counts[r.tone]++;outlets.set(r.outlet,(outlets.get(r.outlet)||0)+1);
    if(r.coverage_group){if(!groups.has(r.coverage_group))groups.set(r.coverage_group,[]);groups.get(r.coverage_group).push(r);}
    const loc=mode==='publisher'?r.publisher_location:r.event_location;
    if(!loc)continue;
    // Exact co-location only; no inferred or substituted event coordinates.
    const key=loc.lat+','+loc.lon;
    if(!clusters.has(key))clusters.set(key,{lat:loc.lat,lon:loc.lon,stories:[],counts:Object.fromEntries(TONES.map(t=>[t,0]))});
    const c=clusters.get(key);c.stories.push(r);c.counts[r.tone]++;
  }
  return {day,searching,mode,reports,counts,outlets:[...outlets],clusters:[...clusters.values()],
    unlocated:reports.filter(r=>!(mode==='publisher'?r.publisher_location:r.event_location)),
    undated:reports.filter(r=>!r.published_at),dateOnly:reports.filter(r=>!r.published_at&&r.published_date_reported),coverageGroups:[...groups],
    checked_at:feed.checked_at,coverage_note:feed.coverage_note};
}

// Producer-side preflight: run against an independently cleared staging export BEFORE making
// its raw bytes public. Browser filtering cannot remove already-public private bytes.
// This is a structural check, NOT editorial approval, rights clearance, or a DB/RLS fix.
export function validatePublicMediaExport(feed) {
  const checkKeys=(obj,allowed,label)=>{
    if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!allowed.includes(k)))
      throw new Error('Unexpected public export fields: '+label);
  };
  checkKeys(feed,['schema_version','kind','checked_at','coverage_note','reports'],'envelope');
  if(!Array.isArray(feed.reports))throw new Error('Invalid public export reports');
  const strings=['id','original_url','outlet','headline_original','language','attribution_url','author','publisher_country',
    'published_at','published_date_reported','tone','tone_rationale','headline_translated','translation_attribution','coverage_group','syndication_id','correction_url'];
  const ids=new Set(),urls=new Set();
  for(const r of feed.reports){
    checkKeys(r,[...strings,'publication_status','editorial_status','topics','publisher_location','event_location'],'report');
    if(r.publication_status!=='published'||r.editorial_status!=='cleared_for_public_index')
      throw new Error('Non-cleared record in public export');
    for(const k of strings)if(r[k]!=null&&typeof r[k]!=='string')throw new Error('Invalid public export field: '+k);
    if(r.published_at!=null&&!timestamp(r.published_at))throw new Error('Invalid publication timestamp');
    if(r.published_date_reported!=null&&!reportedDate(r.published_date_reported))throw new Error('Invalid publisher-reported date');
    if(r.correction_url!=null&&!https(r.correction_url))throw new Error('Invalid correction URL');
    if(!TONES.includes(r.tone)||!clean(r.tone_rationale))throw new Error('Missing provisional reporting tone rationale');
    if(Boolean(clean(r.headline_translated))!==Boolean(clean(r.translation_attribution)))throw new Error('Incomplete translation attribution');
    if(r.topics!=null&&(!Array.isArray(r.topics)||r.topics.some(t=>typeof t!=='string')))throw new Error('Invalid topics');
    for(const kind of ['publisher','event']){
      const loc=r[kind+'_location'];
      if(loc==null)continue;
      checkKeys(loc,['kind','lat','lon','label','basis','source_url','review_status'],kind+' location');
      if(!location(loc,kind))throw new Error('Unverified or invalid '+kind+' location');
    }
    const id=clean(r.id),url=https(r.original_url);
    if(ids.has(id)||urls.has(url))throw new Error('Duplicate public export record');
    ids.add(id);urls.add(url);
  }
  const validated=readMediaFeed(feed);
  if(validated.reports.length!==feed.reports.length)throw new Error('Public export record count mismatch');
  return validated;
}
