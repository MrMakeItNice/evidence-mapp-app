import { OWNER_HTML, PUBLIC_HTML, PRIVACY_HTML } from './pages.ts';
const BASE=Deno.env.get('SUPABASE_URL')||'';
const KEY=Deno.env.get('SUPABASE_ANON_KEY')||'';
const cors={'access-control-allow-origin':'*','access-control-allow-methods':'GET,HEAD,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','cache-control':'no-store','x-content-type-options':'nosniff'};
Deno.serve(async(request:Request)=>{
 const url=new URL(request.url),path=url.pathname;
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(!['GET','HEAD'].includes(request.method))return Response.json({error:'GET or HEAD only'},{status:405,headers:{...cors,allow:'GET, HEAD, OPTIONS'}});
 if(path.endsWith('/health'))return Response.json({ok:true,application:'Evidence Atlas',release:'1.9.0',publicReader:true,ownerWorkspace:true},{headers:cors});
 if(path.includes('/api/')){
   if(!path.endsWith('/api/cases'))return Response.json({error:'Unknown endpoint'},{status:404,headers:cors});
   try{
     const u=new URL(BASE+'/rest/v1/cases');u.searchParams.set('select','id,case_number,title,slug,summary,category,evidence_level,claim_grade,official_finding,disputed_questions,start_date,end_date,country');u.searchParams.set('published','eq.true');u.searchParams.set('order','case_number.asc');u.searchParams.set('limit','1000');
     const r=await fetch(u,{headers:{apikey:KEY,accept:'application/json'},signal:AbortSignal.timeout(10000)});
     if(!r.ok)throw Error('Database status '+r.status);
     const cases=await r.json();if(!Array.isArray(cases))throw Error('Unexpected database response');
     return new Response(request.method==='HEAD'?null:JSON.stringify(cases),{headers:{...cors,'content-type':'application/json; charset=utf-8'}});
   }catch(error){console.error('Public cases unavailable',error);return Response.json({error:'Published case library is temporarily unavailable.'},{status:503,headers:cors});}
 }
 const mode=path.endsWith('/privacy')?'privacy':(url.searchParams.get('workspace')==='1'||url.searchParams.has('preview')||path.endsWith('/index.html'))?'owner':'public';
 return new Response(request.method==='HEAD'?null:mode==='privacy'?PRIVACY_HTML:mode==='owner'?OWNER_HTML:PUBLIC_HTML,{headers:{...cors,'content-type':'text/html; charset=utf-8','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(), microphone=(), geolocation=()'}});
});
