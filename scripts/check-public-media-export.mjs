// Default: read-only preflight. Explicit --stage makes a private temporary candidate copy.
// Never queries a database, modifies a repository file, or publishes an export.
// Usage: node scripts/check-public-media-export.mjs [--stage] /private/staging/candidate.json
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validatePublicMediaExport} from '../media-tracker.mjs';

const args=process.argv.slice(2);
const stage=args[0]==='--stage';
const input=stage?args.slice(1):args;
if(input.length!==1||input[0].startsWith('--')){
  console.error('Usage: node scripts/check-public-media-export.mjs [--stage] <local staging JSON file>');
  process.exitCode=2;
}else{
  let dir;
  try{
    const raw=JSON.parse(await readFile(input[0],'utf8'));
    const checked=validatePublicMediaExport(raw);
    if(stage){
      // Validate BEFORE creating any file. Do not copy raw bytes: repeated JSON
      // keys and discarded text must not leak into the staged representation.
      // The validated envelope retains explicit editorial flags required by the browser.
      dir=await mkdtemp(join(tmpdir(),'atlas-media-stage-'));
      const output=join(dir,'candidate-media-export.json');
      await writeFile(output,JSON.stringify(raw,null,2)+'\n',{flag:'wx',mode:0o600});
      console.log('Private staging candidate: '+output);
      console.log('Keep this directory outside any served web root. No publication performed.');
    }
    console.log('Structural preflight passed: '+checked.reports.length+' records. Not editorial, rights, geographic or release approval.');
  }catch{
    if(dir)await rm(dir,{recursive:true,force:true}).catch(()=>{});
    // Do not echo rejected candidate data, raw bytes, paths, or parse error excerpts into logs.
    console.error('Structural preflight failed. Keep candidate private; inspect locally. No export retained.');
    process.exitCode=1;
  }
}
