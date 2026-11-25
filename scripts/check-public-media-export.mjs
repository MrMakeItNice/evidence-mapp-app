// Read-only staging preflight. Never writes an export or contacts a database.
// Usage: node scripts/check-public-media-export.mjs /private/staging/candidate.json
import {readFile} from 'node:fs/promises';
import {validatePublicMediaExport} from '../media-tracker.mjs';

const args=process.argv.slice(2);
if(args.length!==1){
  console.error('Usage: node scripts/check-public-media-export.mjs <local staging JSON file>');
  process.exitCode=2;
}else{
  try{
    const raw=JSON.parse(await readFile(args[0],'utf8'));
    const checked=validatePublicMediaExport(raw);
    console.log('Structural preflight passed: '+checked.reports.length+' records. Not editorial, rights, geographic or release approval.');
  }catch{
    // Do not echo rejected candidate data, raw bytes, paths, or parse error excerpts into logs.
    console.error('Structural preflight failed. Keep candidate private; inspect locally. No export written.');
    process.exitCode=1;
  }
}
