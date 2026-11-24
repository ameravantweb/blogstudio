import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {prepareMigration} from '../scripts/prepare-migration.mjs';
import {newRecord,sampleBrief} from '../lib/blog.ts';
import {handleRecordSave,handleRecordsList} from '../lib/records.ts';

const original={...newRecord({...sampleBrief(),client:"Client's agency"}),owner:{id:'old-sites-owner',name:"Author's name"}};
const backup={format:'blog-studio-workspace-v1',records:[{record:original,revision:5}],images:[]};
const owners={'old-sites-owner':'author@example.com'};
test('migration preserves complete content, safely quotes SQL, maps authors and can be replayed',async()=>{
  const result=prepareMigration(backup,owners);
  const sqlite=new DatabaseSync(':memory:');
  try{
    sqlite.exec(readFileSync(new URL('../drizzle/0000_square_firebird.sql',import.meta.url),'utf8'));
    sqlite.exec(result.sql);sqlite.exec(result.sql);
    const rows=sqlite.prepare('SELECT * FROM studio_articles').all();
    assert.equal(rows.length,1);assert.equal(rows[0].id,original.id);assert.equal(rows[0].owner_id,'author@example.com');assert.equal(rows[0].owner_name,"Author's name");
    assert.equal(JSON.parse(rows[0].content).brief.client,"Client's agency");
    const db={prepare(sql){return {bind(){return this;},async all(){return {results:rows};},async first(){return rows[0];}};}};
    const data=await (await handleRecordsList(new Request('https://studio.example/api/records'),{user:{id:'colleague@example.com',name:'Colleague'},db})).json();
    assert.equal(data.records[0].record.owner.id,'author@example.com');
    const request=new Request('https://studio.example/api/records/'+original.id,{method:'PUT',headers:{Origin:'https://studio.example','Content-Type':'application/json'},body:JSON.stringify({record:original,revision:1})});
    assert.equal((await handleRecordSave(request,original.id,{user:{id:'colleague@example.com',name:'Colleague'},db})).status,403);
  }finally{sqlite.close();}
});
test('migration rejects unmapped owners, duplicate IDs and missing image bytes',()=>{
  assert.throws(()=>prepareMigration(backup,{}),/Map every/);
  assert.throws(()=>prepareMigration({...backup,records:[...backup.records,...backup.records]},owners),/Duplicate article/);
  const imageId=crypto.randomUUID();
  const image={id:imageId,url:'/api/images/'+imageId,alt:'An illustration',prompt:'Editorial scene',createdAt:new Date().toISOString(),width:1536,height:1024};
  const pictured={...backup,records:[{record:{...original,image},revision:1}]};
  assert.throws(()=>prepareMigration(pictured,owners),/image is missing/);
  const bytes=Buffer.from('RIFFxxxxWEBPfixture');
  assert.equal(prepareMigration({...pictured,images:[{id:imageId,base64:bytes.toString('base64')}]},owners).images.get(imageId).toString(),bytes.toString());
});
