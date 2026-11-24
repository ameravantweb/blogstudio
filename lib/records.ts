import type {RecordItem} from './blog.ts';
import {MAX_RECORDS,parseImport,recordExport} from './blog.ts';
import {boundedBody,json} from './generation.ts';
export type WorkspaceUser={id:string;name:string};
export type StoredRecord={record:RecordItem;revision:number};
export type WorkspaceData={user:WorkspaceUser;records:StoredRecord[]};
type Options={user:WorkspaceUser|null;db?:D1Database};
type Row={id:string;owner_id:string;owner_name:string;content:string;revision:number;updated_at:string};
const idPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function validateRecord(value:unknown):RecordItem{
 const data=value as RecordItem;if(!data||!idPattern.test(data.id)||typeof data.updatedAt!=='string'||Number.isNaN(Date.parse(data.updatedAt)))throw new Error('The saved article details are invalid.');
 return {...parseImport({version:1,...data}),id:data.id,updatedAt:data.updatedAt};
}
function fromRow(row:Row):StoredRecord{return {record:{...validateRecord(JSON.parse(row.content)),id:row.id,owner:{id:row.owner_id,name:row.owner_name}},revision:row.revision};}
function guard(request:Request,options:Options,write=false){
 if(!options.user)return json({error:'Sign in to access the article workspace.'},401);
 if(!options.db)return json({error:'Shared article storage is temporarily unavailable. Your browser backup is safe.'},503);
 if(write&&(request.headers.get('Origin')!==new URL(request.url).origin||!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')))return json({error:'Save articles from this site using a JSON request.'},403);
 return null;
}
export async function handleRecordsList(request:Request,options:Options){const denied=guard(request,options);if(denied)return denied;try{const result=await options.db!.prepare('SELECT * FROM studio_articles ORDER BY updated_at DESC LIMIT ?').bind(MAX_RECORDS).all<Row>();return json({user:options.user,records:result.results.map(fromRow)});}catch{return json({error:'Articles could not be loaded. Your browser backup is safe; retry shortly.'},503);}}
export async function handleRecordSave(request:Request,id:string,options:Options){
 const denied=guard(request,options,true);if(denied)return denied;
 let record:RecordItem,revision:number|null;
 try{const data=JSON.parse(await boundedBody(request,180000));record=validateRecord(data.record);if(record.id!==id)throw new Error('The article ID does not match.');revision=data.revision;if(revision!==null&&(!Number.isInteger(revision)||revision!<1))throw new Error('The article revision is invalid.');}catch(e){return json({error:e instanceof Error?e.message:'This article could not be saved.'},400);}
 try{
  const db=options.db!;const user=options.user!;const prior=await db.prepare('SELECT * FROM studio_articles WHERE id = ?').bind(id).first<Row>();
  if(prior&&prior.owner_id!==user.id)return json({error:'Only the author can edit this article. You can view, export, or create your own copy.'},403);
  const content=JSON.stringify({...record,owner:undefined});let nextRevision=1;
  if(prior){if(revision!==prior.revision)return json({error:'This article changed on another device. Export your current changes, then reload to see the latest saved version.'},409);const updated=await db.prepare('UPDATE studio_articles SET content = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND owner_id = ? AND revision = ?').bind(content,record.updatedAt,id,user.id,revision).run();if(!updated.meta.changes)return json({error:'This article changed on another device. Export your changes before reloading.'},409);nextRevision=prior.revision+1;
  }else{if(revision!==null)return json({error:'This article was removed from the shared workspace. Export your changes before reloading.'},409);const count=await db.prepare('SELECT COUNT(*) AS count FROM studio_articles').first<{count:number}>();if((count?.count||0)>=MAX_RECORDS)return json({error:`The workspace holds ${MAX_RECORDS} briefs. Export and delete an old brief before adding another.`},409);const inserted=await db.prepare('INSERT OR IGNORE INTO studio_articles (id, owner_id, owner_name, content, revision, updated_at) VALUES (?, ?, ?, ?, 1, ?)').bind(id,user.id,user.name,content,record.updatedAt).run();if(!inserted.meta.changes)return json({error:'An article with this ID was already saved. Reload the workspace.'},409);}
  return json({record:{...record,owner:prior?{id:prior.owner_id,name:prior.owner_name}:user},revision:nextRevision});
 }catch{return json({error:'Cloud saving failed. Your changes remain in this browser; retry shortly.'},503);}
}
export async function handleRecordDelete(request:Request,id:string,options:Options){
 const denied=guard(request,options,true);if(denied)return denied;if(!idPattern.test(id))return json({error:'Article not found.'},404);
 try{const data=JSON.parse(await boundedBody(request,2000));const prior=await options.db!.prepare('SELECT * FROM studio_articles WHERE id = ?').bind(id).first<Row>();if(!prior)return json({deleted:true});if(prior.owner_id!==options.user!.id)return json({error:'Only the author can delete this article.'},403);if(data.revision!==prior.revision)return json({error:'The article changed on another device. Reload before deleting it.'},409);const result=await options.db!.prepare('DELETE FROM studio_articles WHERE id = ? AND owner_id = ? AND revision = ?').bind(id,options.user!.id,data.revision).run();if(!result.meta.changes)return json({error:'The article changed before deletion. Reload and review it.'},409);return json({deleted:true});}catch{return json({error:'The article could not be deleted. Please retry.'},503);}
}
export async function handleRecordsImport(request:Request,options:Options){
 const denied=guard(request,options,true);if(denied)return denied;
 let records:RecordItem[];try{const data=JSON.parse(await boundedBody(request,6000000));if(!Array.isArray(data.records)||data.records.length>MAX_RECORDS)throw new Error('The migration contains too many articles.');records=data.records.map(validateRecord);}catch(e){return json({error:e instanceof Error?e.message:'Browser articles could not be imported.'},400);}
 try{const existing=await options.db!.prepare('SELECT * FROM studio_articles ORDER BY updated_at DESC LIMIT ?').bind(MAX_RECORDS).all<Row>();const ids=new Set(existing.results.map(row=>row.id));const missing=records.filter(record=>!ids.has(record.id));if(missing.length+existing.results.length>MAX_RECORDS)return json({error:'The workspace is full. Export your browser articles before deleting old briefs.'},409);if(missing.length)await options.db!.batch(missing.map(record=>options.db!.prepare('INSERT OR IGNORE INTO studio_articles (id, owner_id, owner_name, content, revision, updated_at) VALUES (?, ?, ?, ?, 1, ?)').bind(record.id,options.user!.id,options.user!.name,JSON.stringify(record),record.updatedAt)));return handleRecordsList(request,options);}catch{return json({error:'Browser articles could not be migrated. They are still saved in this browser; retry shortly.'},503);}
}
