import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const BASE=Deno.env.get("SUPABASE_URL")||"";
const ANON=Deno.env.get("SUPABASE_ANON_KEY")||"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const OWNER="cdfff424-d750-4f82-baa3-d17a6113af53";
const h={"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"authorization,apikey,content-type","cache-control":"no-store","content-type":"application/json; charset=utf-8"};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:h});
async function db(table:string,method:string,query:Record<string,string>,body?:unknown){
  const u=new URL(BASE+"/rest/v1/"+table);
  for(const key in query)u.searchParams.set(key,query[key]);
  const r=await fetch(u,{method,headers:{apikey:SERVICE,authorization:"Bearer "+SERVICE,"content-type":"application/json",prefer:"resolution=merge-duplicates,return=representation"},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(13000)});
  if(!r.ok)throw Error("Database error "+r.status);
  return await r.json().catch(()=>[]);
}
async function owner(req:Request){
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer ")||auth.length>5000)return false;
  const r=await fetch(BASE+"/auth/v1/user",{headers:{apikey:ANON,authorization:auth},signal:AbortSignal.timeout(6000)});
  if(!r.ok)return false;
  return (await r.json()).id===OWNER;
}
function urlSafe(v:unknown){
  try{const u=new URL(String(v));if(!["https:","http:"].includes(u.protocol))return null;
    u.hash="";
    for(const p of [...u.searchParams.keys()])if(p.startsWith("utm_")||["fbclid","gclid"].includes(p))u.searchParams.delete(p);
    return u.toString().slice(0,2048);}catch{return null;}
}
function frame(title:string){
 const t=" "+title.toLowerCase().replace(/[^a-z0-9 ]/g," ")+" ";
 const lex:Record<string,string[]>={uncertainty:["allegedly","reportedly","claims","unconfirmed"],certainty:["confirmed","proven","undeniable","debunked"],urgency:["urgent","breaking","crisis","emergency"],emotion:["shocking","outrage","terrifying","shameful"],attribution:["officials say","sources say","study finds","experts say"]};
 const result:Record<string,string[]>={};
 for(const group in lex){const found=lex[group].filter(word=>t.includes(" "+word+" "));if(found.length)result[group]=found;}
 return result;
}
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:h,status:204});
  if(req.method==="GET")return reply({status:"ready",auth:"owner required to collect",news_feed:"GDELT DOC metadata",auto_publish:false,model_based_propaganda_detection:false});
  if(req.method!=="POST")return reply({error:"POST only"},405);
  if(!BASE||!ANON||!SERVICE)return reply({error:"Backend configuration missing"},503);
  try{
    if(!await owner(req))return reply({error:"Owner login required"},401);
    const input=await req.json().catch(()=>({}));
    const id=Number(input.topic_id);
    if(!Number.isSafeInteger(id)||id<1)return reply({error:"Positive topic_id required"},400);
    const row=await db("news_watch_topics","GET",{id:"eq."+id,select:"id,name,search_query,active,last_collected_at",limit:"1"});
    const topic=row[0];
    if(!topic||!topic.active)return reply({error:"Inactive or unknown topic"},404);
    if(topic.last_collected_at&&Date.now()-new Date(topic.last_collected_at).getTime()<600000)return reply({error:"Checked recently. Try again in 10 minutes."},429);
    const u=new URL("https://api.gdeltproject.org/api/v2/doc/doc");
    for(const [k,v] of Object.entries({query:String(topic.search_query).slice(0,200),mode:"artlist",format:"json",maxrecords:"25",timespan:"24h",sort:"datedesc"}))u.searchParams.set(k,v);
    const response=await fetch(u,{headers:{accept:"application/json"},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error("Discovery provider status "+response.status);
    const raw=await response.text();
    if(raw.length>900000)throw Error("Provider output too large");
    const parsed=JSON.parse(raw);
    const list=Array.isArray(parsed.articles)?parsed.articles.slice(0,25):[];
    const domains=new Set<string>();let ingested=0,failures=0;
    for(const item of list){
      const link=urlSafe(item?.url);
      const title=String(item?.title||"").trim().slice(0,950);
      if(!link||!title)continue;
      const domain=new URL(link).hostname.replace(/^www\./,"");
      domains.add(domain);
      const seen=String(item?.seendate||"");
      const timestamp=/^\d{14}$/.test(seen)?seen.substring(0,4)+"-"+seen.substring(4,6)+"-"+seen.substring(6,8)+"T"+seen.substring(8,10)+":"+seen.substring(10,12)+":"+seen.substring(12,14)+"Z":null;
      try{
        const saved=await db("news_articles","POST",{on_conflict:"canonical_url",select:"id"},[{canonical_url:link,title,outlet_domain:domain,country:String(item.sourcecountry||"").slice(0,70)||null,language:String(item.language||"").slice(0,70)||null,first_seen_at:timestamp,headline_normalized:title.toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," "),frame_signals:frame(title)}]);
        if(saved[0]?.id){await db("news_article_topics","POST",{on_conflict:"article_id,topic_id"},[{article_id:saved[0].id,topic_id:id}]);ingested++;}
      }catch{failures++;}
    }
    await db("news_watch_topics","PATCH",{id:"eq."+id}, {last_collected_at:new Date().toISOString()});
    return reply({status:"collected",topic:topic.name,found:list.length,indexed:ingested,distinct_outlets:domains.size,failed:failures,review_status:"private pending",rights:"headline,metadata,original link only"});
  }catch(e){console.error("news collector",e);return reply({error:"Collection unavailable",detail:e instanceof Error?e.message:"unknown"},503);}
});
