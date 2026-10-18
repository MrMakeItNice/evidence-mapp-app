import fs from 'node:fs';
const dir='supabase/functions/evidence-atlas';
const read=p=>fs.readFileSync(p,'utf8');
const frontend=read('index.html').replace(/<script data-public-landing-redirect>[\s\S]*?<\/script>/,'');
const publicPage=read('discover.html').replaceAll('./index.html?workspace=1','?workspace=1').replaceAll('./discover.html','#');
fs.writeFileSync(dir+'/pages.ts','export const OWNER_HTML='+JSON.stringify(frontend)+';\nexport const PUBLIC_HTML='+JSON.stringify(publicPage)+';\nexport const PRIVACY_HTML='+JSON.stringify(read('privacy.html'))+';\n');
console.log('Prepared Edge Function pages from current source.');
