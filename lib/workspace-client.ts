import type {RecordItem} from './blog.ts';
import {MAX_RECORDS,STORAGE_KEY,newRecord,parseImport} from './blog.ts';
import type {WorkspaceData,WorkspaceUser} from './records.ts';
export type WorkspaceCache={version:1;records:RecordItem[];activeId:string;cloudUserId?:string;dirtyIds?:string[];revisions?:Record<string,number>};
export function parseCache(raw:string|null):WorkspaceCache|null{
 if(!raw)return null;const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.records)||data.records.length>MAX_RECORDS)throw new Error('Saved browser articles could not be read. The original backup has been preserved.');
 const records=data.records.map((record:RecordItem)=>{if(typeof record.id!=='string'||!record.id||typeof record.updatedAt!=='string')throw new Error('Invalid browser record.');return {...parseImport({version:1,...record}),id:record.id,updatedAt:record.updatedAt,...(record.owner?{owner:record.owner}:{})};});
 if(new Set(records.map((record:RecordItem)=>record.id)).size!==records.length)throw new Error('Duplicate browser records.');return {...data,records};
}
export async function readWorkspaceResponse(response:Response){let result:unknown;try{result=await response.json();}catch{throw new Error('The shared workspace could not be reached. Your browser backup is safe.');}if(!response.ok){const error=(result as {error?:unknown})?.error;throw new Error(typeof error==='string'?error:'The shared workspace could not be reached.');}return result;}
export function parseWorkspace(value:unknown):WorkspaceData{
 const data=value as WorkspaceData;if(!data?.user||typeof data.user.id!=='string'||typeof data.user.name!=='string'||!Array.isArray(data.records)||data.records.length>MAX_RECORDS)throw new Error('The shared workspace response was incomplete.');
 return {user:data.user,records:data.records.map(item=>{const record=item.record;if(!record?.owner||typeof record.owner.id!=='string'||typeof record.owner.name!=='string'||typeof record.id!=='string'||typeof record.updatedAt!=='string'||!Number.isInteger(item.revision)||item.revision<1)throw new Error('The shared article response was incomplete.');return {record:{...parseImport({version:1,...record}),id:record.id,updatedAt:record.updatedAt,owner:record.owner},revision:item.revision};})};
}
export function mergePending(cloud:WorkspaceData,cache:WorkspaceCache|null){
 const records=cloud.records.map(item=>item.record);if(cache?.cloudUserId!==cloud.user.id)return records;
 for(const cached of cache.records){if(!cache.dirtyIds?.includes(cached.id)||cached.owner&&cached.owner.id!==cloud.user.id)continue;const index=records.findIndex(record=>record.id===cached.id);if(index>=0&&records[index].owner?.id!==cloud.user.id)continue;
  const stored=cloud.records.find(item=>item.record.id===cached.id);const previous=cache.revisions?.[cached.id];
  if(previous&&(!stored||stored.revision!==previous)){const recovered={...cached,id:newRecord().id,updatedAt:new Date().toISOString(),completedAt:null,owner:cloud.user,article:cached.article?{...cached.article,title:`${cached.article.title} (recovered browser edits)`}:null};records.unshift(recovered);continue;}
  if(index<0)records.unshift(cached);else records[index]=cached;
 }
 return records;
}
export async function loadCloudWorkspace(cache:WorkspaceCache|null,fetcher:typeof fetch=fetch):Promise<WorkspaceData>{
 let data=parseWorkspace(await readWorkspaceResponse(await fetcher('/api/records',{cache:'no-store'})));
 if(cache&&!cache.cloudUserId&&cache.records.length){data=parseWorkspace(await readWorkspaceResponse(await fetcher('/api/records/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({records:cache.records}),signal:AbortSignal.timeout(30000)})));}
 return data;
}
export function workspaceBackup(records:RecordItem[],activeId:string,user:WorkspaceUser|null,snapshots:Map<string,string>,revisions:Map<string,number>):WorkspaceCache{
 return {version:1,records,activeId,...(user?{cloudUserId:user.id}:{}),dirtyIds:records.filter(record=>(!record.owner||record.owner.id===user?.id)&&snapshots.get(record.id)!==JSON.stringify(record)).map(record=>record.id),revisions:Object.fromEntries(revisions)};
}
export {STORAGE_KEY};
