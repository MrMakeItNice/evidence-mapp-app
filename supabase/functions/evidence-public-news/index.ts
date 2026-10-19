const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','content-type':'application/json; charset=utf-8','cache-control':'public, max-age=180','x-content-type-options':'nosniff'};
const topics:Record<string,{query:string;feed:string;scope:string}>={
 world:{query:'(international OR diplomacy OR humanitarian) sourcelang:english',feed:'world',scope:'BBC World'},
 government:{query:'(government OR parliament OR congress) accountability sourcelang:english',feed:'politics',scope:'BBC Politics (primarily UK)'},
 environment:{query:'(environment OR pollution OR climate) sourcelang:english',feed:'science_and_environment',scope:'BBC Science & Environment'},
 science:{query:'(research OR science OR technology) sourcelang:english',feed:'technology',scope:'BBC Technology'},
 health:{query:'("public health" OR "medical research") sourcelang:english',feed:'health',scope:'BBC Health'},
 rights:{query:'("human rights" OR "civil liberties") sourcelang:english',feed:'world',scope:'BBC World (broader than human rights)'}
};
const sensitive=/\b(kill(?:ed|ing)?|murder|massacre|suicide|torture|rape|assault|shooting|bombing|dead|death|graphic|behead|trafficking|genocide)\b/i;
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:status===200?headers:{...headers,'cache-control':'no-store'}});
function safeURL(s:unknown){try{const u=new URL(String(s));return ['http:','https:'].includes(u.protocol)&&u.href.length<=2048?u.href:null;}catch{return null;}}
function decode(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,'').replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,e=>{const named:Record<string,string>={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(named[e])return named[e];const n=e.startsWith('&#x')?parseInt(e.slice(3),16):parseInt(e.slice(2),10);return Number.isFinite(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}).trim();}
function tag(s:string,t:string){const m=s.match(new RegExp('<'+t+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+t+'>','i'));return m?decode(m[1]):'';}
async function gdelt(topic:string){const u=new URL('https://api.gdeltproject.org/api/v2/doc/doc');for(const [k,v]of Object.entries({query:topics[topic].query,mode:'artlist',format:'json',maxrecords:'20',timespan:'24h',sort:'datedesc'}))u.searchParams.set(k,v);const r=await fetch(u,{headers:{accept:'application/json'},signal:AbortSignal.timeout(4500)});if(!r.ok)throw Error('Discovery status '+r.status);const text=await r.text();if(text.length>850000)throw Error('Oversized response');const p=JSON.parse(text);if(!Array.isArray(p.articles))throw Error('No article list');return p.articles.map((a:Record<string,unknown>)=>{const raw=String(a.seendate||'');const date=/^\d{8}T\d{6}Z$/.test(raw)?raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6Z'):/^\d{14}$/.test(raw)?raw.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,'$1-$2-$3T$4:$5:$6Z'):null;return {title:String(a.title||''),url:a.url,first_seen:date,language:String(a.language||'English'),country:String(a.sourcecountry||'')};});}
async function rss(topic:string){const r=await fetch('https://feeds.bbci.co.uk/news/'+topics[topic].feed+'/rss.xml',{signal:AbortSignal.timeout(6500)});if(!r.ok)throw Error('RSS status '+r.status);const xml=await r.text();if(xml.length>1000000||!xml.includes('<rss'))throw Error('Invalid RSS');return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,20).map(m=>{const d=tag(m[1],'pubDate');return {title:tag(m[1],'title'),url:tag(m[1],'link'),first_seen:d&&!Number.isNaN(Date.parse(d))?new Date(d).toISOString():null,language:'English',country:''};});}
const positiveFeeds=[{name:'Positive News',url:'https://www.positive.news/feed/'},{name:'Reasons to be Cheerful',url:'https://reasonstobecheerful.world/feed/'}];
async function positiveNews(){
 const results=await Promise.allSettled(positiveFeeds.map(async source=>{
  const r=await fetch(source.url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Feed unavailable');
  const xml=await r.text();if(xml.length>1000000||!xml.includes('<rss'))throw Error('Invalid feed');
  const articles=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].slice(0,8).flatMap(m=>{
   const url=safeURL(tag(m[1],'link')),title=tag(m[1],'title').replace(/\s+/g,' ').trim().slice(0,300),raw=tag(m[1],'pubDate');
   const date=raw&&!Number.isNaN(Date.parse(raw))?new Date(raw).toISOString():null;
   return url&&title?[{title,url,author:(tag(m[1],'dc:creator')||tag(m[1],'author')).slice(0,160),first_seen:date,publisher:new URL(url).hostname.replace(/^www\./,''),sensitive:sensitive.test(title),language:'English',country:''}]:[];
  });if(!articles.length)throw Error('Empty feed');return {name:source.name,articles};
 }));
 const sources=results.map((r,i)=>({name:positiveFeeds[i].name,status:r.status==='fulfilled'?'available':'unavailable'}));
 const articles=results.flatMap(r=>r.status==='fulfilled'?r.value.articles:[]).sort((a,b)=>String(b.first_seen||'').localeCompare(String(a.first_seen||''))).filter((a,i,all)=>all.findIndex(x=>x.url===a.url)===i).slice(0,15);
 if(!articles.length)return reply({error:'Positive-progress feeds are temporarily unavailable.',sources,articles:[]},503);
 const value={mode:'constructive_reporting_discovery',topic:'positive',provider:results.flatMap(r=>r.status==='fulfilled'?[r.value.name]:[]).join(' + ')+' RSS',sources,fetched_at:new Date().toISOString(),articles,notice:'Publisher-selected constructive reporting. Check publication dates and original evidence; coverage is not worldwide or exhaustive.',disclaimer:'Original headlines and links only. Reporting on progress does not establish a treatment works or that a proposed solution has succeeded.'};
 cache.set('positive',{at:Date.now(),value});return reply(value);
}
// Warm-isolate cache avoids requesting an external feed on every visitor.
const cache=new Map<string,{at:number;value:unknown}>();
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='GET')return reply({error:'GET only'},405);const topic=new URL(req.url).searchParams.get('topic')||'world';if(topic!=='positive'&&!Object.hasOwn(topics,topic))return reply({error:'Unknown news category'},400);const cached=cache.get(topic);if(cached&&Date.now()-cached.at<180000)return reply(cached.value);if(topic==='positive')return positiveNews();
 try{let articles,provider='GDELT',notice='English-language discovery from the last 24 hours. Headlines are unverified publisher claims.';try{articles=await gdelt(topic);if(!articles.length)throw Error('No discovery results');}catch{articles=await rss(topic);provider=topics[topic].scope+' RSS fallback';notice='Limited fallback from one publisher; use article dates and compare other outlets. Headlines are unverified publisher claims.';}
 const unique=new Set<string>();const result=[];for(const a of articles){const url=safeURL(a.url),title=String(a.title||'').replace(/\s+/g,' ').trim().slice(0,300);if(!url||!title||unique.has(url))continue;unique.add(url);result.push({...a,title,url,publisher:new URL(url).hostname.replace(/^www\./,''),sensitive:sensitive.test(title)});if(result.length===15)break;}
 const value={mode:'news_discovery',topic,provider,notice,fetched_at:new Date().toISOString(),articles:result,disclaimer:'Metadata and original links only. Discovery is not exhaustive and does not independently verify reporting.'};cache.set(topic,{at:Date.now(),value});return reply(value);
 }catch{ return reply({error:'News providers are temporarily unavailable. Please retry.',articles:[]},503);}
});
