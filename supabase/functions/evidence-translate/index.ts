const BASE=Deno.env.get('SUPABASE_URL')||'',ANON=Deno.env.get('SUPABASE_ANON_KEY')||'',KEY=Deno.env.get('DEEPL_API_KEY')||'';
const OWNER='cdfff424-d750-4f82-baa3-d17a6113af53';
const headers={'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','cache-control':'no-store','x-content-type-options':'nosniff'};
const respond=(v:unknown,status=200)=>Response.json(v,{status,headers});
const lastRun=new Map<string,number>();
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method==='GET')return respond({configured:!!KEY,provider:'DeepL',source_preserved:true,max_characters:20000});
 if(req.method!=='POST')return respond({error:'POST only'},405);
 try{
 const authorization=req.headers.get('authorization')||'';
 if(!authorization.startsWith('Bearer ')||authorization.length>5000)return respond({error:'Owner sign-in required'},401);
 const auth=await fetch(BASE+'/auth/v1/user',{headers:{apikey:ANON,authorization},signal:AbortSignal.timeout(6000)});
 if(!auth.ok||(await auth.json()).id!==OWNER)return respond({error:'Owner sign-in required'},401);
 if(!KEY)return respond({error:'Server translation is not configured. Add DEEPL_API_KEY in Supabase Edge Function secrets, or use on-device translation in a supported desktop browser. Originals are unchanged.'},503);
 if(Number(req.headers.get('content-length'))>100000)return respond({error:'Request too large'},413);
 const raw=await req.text();if(raw.length>100000)return respond({error:'Request too large'},413);
 let input;try{input=JSON.parse(raw);}catch{return respond({error:'Invalid JSON'},400);}
 const text=String(input.text||''),source=String(input.source_language||'').toUpperCase(),target=String(input.target_language||'EN').toUpperCase();
 const languages=new Set(['EN','ES','FR','PT','DE','AR','ZH','HI','IT','JA']);
 if(!text.trim()||text.length>20000||!languages.has(source)||!languages.has(target))return respond({error:'Select supported languages and enter 1–20,000 characters.'},400);
 if(input.consent!==true)return respond({error:'Confirm that this text may be sent to DeepL for translation.'},400);
 if(Date.now()-(lastRun.get(OWNER)||0)<4000)return respond({error:'Please wait a few seconds before translating again.'},429);
 if(source===target)return respond({translation:text,source_language:source.toLowerCase(),target_language:target.toLowerCase(),engine:'manual',review_status:'pending'});
 lastRun.set(OWNER,Date.now());
 const url=KEY.endsWith(':fx')?'https://api-free.deepl.com/v2/translate':'https://api.deepl.com/v2/translate';
 const r=await fetch(url,{method:'POST',headers:{authorization:'DeepL-Auth-Key '+KEY,'content-type':'application/json'},body:JSON.stringify({text:[text],source_lang:source,target_lang:target,preserve_formatting:true}),signal:AbortSignal.timeout(25000)});
 if(!r.ok)return respond({error:r.status===456?'Translation quota reached. Original text is unchanged.':'Translation provider could not complete this request. Original text is unchanged.'},503);
 const data=await r.json(),translated=data.translations?.[0]?.text;
 if(typeof translated!=='string'||!translated.trim())return respond({error:'No translated text returned. Original text is unchanged.'},502);
 return respond({translation:translated,source_language:source.toLowerCase(),target_language:target.toLowerCase(),engine:'deepl',review_status:'pending'});
 }catch{return respond({error:'Translation unavailable. Original text is unchanged.'},503);}
});
