'use client';
import {useEffect,useRef,useState} from 'react';
import {RecordItem,newRecord,STORAGE_KEY} from '@/lib/blog';
import type {WorkspaceUser} from '@/lib/records';
import {loadCloudWorkspace,mergePending,parseCache,parseWorkspace,readWorkspaceResponse,workspaceBackup} from '@/lib/workspace-client';

export function useWorkspace(){
 const [records,setRecords]=useState<RecordItem[]>([]);const [activeId,setActiveId]=useState('');const [loaded,setLoaded]=useState(false);const [user,setUser]=useState<WorkspaceUser|null>(null);const [status,setStatus]=useState<'loading'|'saving'|'saved'|'offline'>('loading');const [cloudError,setCloudError]=useState('');const [cacheError,setCacheError]=useState('');const [retry,setRetry]=useState(0);
 const ready=useRef(false);const snapshots=useRef(new Map<string,string>());const revisions=useRef(new Map<string,number>());const latest=useRef(records);latest.current=records;const serial=useRef<Promise<void>>(Promise.resolve());const blocked=useRef(false);const removed=useRef(new Set<string>());const actor=useRef<WorkspaceUser|null>(null);
 async function load(){let cache=null;ready.current=false;try{cache=parseCache(localStorage.getItem(STORAGE_KEY));}catch(e){setCacheError(e instanceof Error?e.message:'Browser backup could not be loaded.');}
  try{const cloud=await loadCloudWorkspace(cache);actor.current=cloud.user;setUser(cloud.user);snapshots.current=new Map(cloud.records.map(item=>[item.record.id,JSON.stringify(item.record)]));revisions.current=new Map(cloud.records.map(item=>[item.record.id,item.revision]));let next=mergePending(cloud,cache);if(cache?.cloudUserId===cloud.user.id)for(const id of cache.dirtyIds||[]){if(cache.revisions?.[id])revisions.current.set(id,cache.revisions[id]);}if(!next.length)next=[newRecord()];setRecords(next);setActiveId(next.some(record=>record.id===cache?.activeId)?cache!.activeId:next[0].id);ready.current=true;blocked.current=false;setCloudError('');setStatus('saved');}
  catch(e){ready.current=false;setCloudError(e instanceof Error?e.message:'Shared articles could not be loaded.');setStatus('offline');if(!latest.current.length){const next=cache?.records.length?cache.records:[newRecord()];setRecords(next);setActiveId(next.some(record=>record.id===cache?.activeId)?cache!.activeId:next[0].id);}}
  finally{setLoaded(true);}
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(!loaded||cacheError)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(workspaceBackup(records,activeId,actor.current,snapshots.current,revisions.current)));}catch{setCacheError('The browser backup could not be saved. Keep this page open until cloud saving completes, or export a backup.');}},[records,activeId,loaded,status,cacheError]);
 useEffect(()=>{if(!loaded||!ready.current||blocked.current)return;const dirty=records.some(record=>!removed.current.has(record.id)&&(!record.owner||record.owner.id===actor.current?.id)&&snapshots.current.get(record.id)!==JSON.stringify(record));if(!dirty)return;setStatus('saving');const timer=setTimeout(()=>{serial.current=serial.current.catch(()=>{}).then(async()=>{
   while(true){const record=latest.current.find(item=>!removed.current.has(item.id)&&(!item.owner||item.owner.id===actor.current?.id)&&snapshots.current.get(item.id)!==JSON.stringify(item));if(!record)break;
    try{const result=await readWorkspaceResponse(await fetch(`/api/records/${record.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({record,revision:revisions.current.get(record.id)??null}),signal:AbortSignal.timeout(20000)}));const saved=parseWorkspace({user:actor.current,records:[result]}).records[0];revisions.current.set(record.id,saved.revision);snapshots.current.set(record.id,JSON.stringify(saved.record));const current=latest.current.map(item=>item.id===record.id?JSON.stringify(item)===JSON.stringify(record)?saved.record:{...item,owner:saved.record.owner}:item);latest.current=current;setRecords(current);}
    catch(e){blocked.current=true;setCloudError(e instanceof Error?e.message:'Shared saving failed. Your browser backup is safe.');setStatus('offline');return;}
   }
   setCloudError('');setStatus('saved');
  });},500);return()=>clearTimeout(timer);},[records,loaded,retry]);
 async function deleteRecord(id:string){if(!ready.current)throw new Error('Reconnect shared storage before deleting this article.');removed.current.add(id);try{await serial.current;const revision=revisions.current.get(id);if(revision!==undefined)await readWorkspaceResponse(await fetch(`/api/records/${id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision}),signal:AbortSignal.timeout(20000)}));snapshots.current.delete(id);revisions.current.delete(id);const rest=latest.current.filter(record=>record.id!==id);const next=rest.length?rest:[newRecord()];latest.current=next;setRecords(next);setActiveId(next[0].id);}catch(e){removed.current.delete(id);throw e;}}
 function retrySaving(){if(!ready.current){void load();return;}blocked.current=false;setCloudError('');setRetry(value=>value+1);}
 async function refreshWorkspace(){setLoaded(false);setStatus('loading');await serial.current;try{if(!cacheError)localStorage.setItem(STORAGE_KEY,JSON.stringify(workspaceBackup(latest.current,activeId,actor.current,snapshots.current,revisions.current)));}catch{}await load();}
 return {records,setRecords,activeId,setActiveId,loaded,user,status,cloudError,cacheError,retrySaving,deleteRecord,refreshWorkspace};
}
