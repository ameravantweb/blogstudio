import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';

const [directory,bucket,mode]=process.argv.slice(2);
if(!directory||!bucket||!['--local','--remote'].includes(mode)||!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)){
  console.error('Usage: pnpm migration:restore migration-output your-r2-bucket --local|--remote');process.exit(1);
}
const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
if(!Array.isArray(manifest.images)||manifest.images.some(id=>!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)))throw new Error('Invalid migration manifest.');
function wrangler(args){
  const result=spawnSync(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),...args],{stdio:'inherit'});
  if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);
}
// Images go first so imported articles never refer to an image still waiting to upload.
for(const id of manifest.images)wrangler(['r2','object','put',bucket+'/article-images/'+id+'.webp','--file',resolve(directory,'images',id+'.webp'),'--content-type','image/webp',mode]);
wrangler(['d1','execute','DB','--file',resolve(directory,'articles.sql'),mode]);
console.log(`Restored the migration to ${mode.slice(2)} storage. Existing article IDs were preserved.`);
