import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateRecord} from '../lib/records.ts';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
export function prepareMigration(backup,owners){
  if(backup?.format!=='blog-studio-workspace-v1'||!Array.isArray(backup.records)||!Array.isArray(backup.images)||backup.records.length>200)throw new Error('Unrecognized workspace backup.');
  const imageMap=new Map();
  for(const image of backup.images){
    if(!uuid.test(image.id)||typeof image.base64!=='string'||imageMap.has(image.id))throw new Error('Invalid or duplicate image.');
    const data=Buffer.from(image.base64,'base64');
    if(data.length>18000000||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP')throw new Error('Invalid WebP image.');
    imageMap.set(image.id,data);
  }
  const ids=new Set();
  const rows=backup.records.map(row=>{
    const record=validateRecord(row.record);
    if(ids.has(record.id))throw new Error('Duplicate article ID.');ids.add(record.id);
    const email=owners[row.record.owner?.id]?.trim().toLowerCase();
    if(!email||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Map every original owner ID to the author’s Cloudflare Access email in owners.json.');
    if(record.image&&!imageMap.has(record.image.id))throw new Error('An article image is missing from the backup.');
    return `INSERT OR IGNORE INTO studio_articles (id,owner_id,owner_name,content,revision,updated_at) VALUES (${literal(record.id)},${literal(email)},${literal(row.record.owner?.name||email)},${literal(JSON.stringify({...record,owner:undefined}))},1,${literal(record.updatedAt)});`;
  });
  return {sql:rows.join('\n')+'\n',images:imageMap,records:rows.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [backupPath,ownersPath,output='migration-output']=process.argv.slice(2);
  if(!backupPath){console.error('Usage: pnpm migration:prepare /path/workspace-export.json [owners.json] [output-directory]');process.exit(1);}
  const backup=JSON.parse(await readFile(backupPath,'utf8'));
  if(!ownersPath){
    const owners=Object.fromEntries(backup.records.map(row=>[row.record.owner.id,{name:row.record.owner.name,email:'fill-in-author-email@example.com'}]));
    console.log(JSON.stringify(owners,null,2));
    console.log('Create owners.json mapping each ID directly to an email string; then run again with its path.');
  }else{
    const result=prepareMigration(backup,JSON.parse(await readFile(ownersPath,'utf8')));
    await mkdir(join(output,'images'),{recursive:true});
    await writeFile(join(output,'articles.sql'),result.sql,{mode:0o600});
    for(const [id,data] of result.images)await writeFile(join(output,'images',id+'.webp'),data,{mode:0o600});
    await writeFile(join(output,'manifest.json'),JSON.stringify({records:result.records,images:[...result.images.keys()]},null,2));
    console.log(`Prepared ${result.records} records and ${result.images.size} images in ${output}. No remote data changed.`);
  }
}
