import {env} from 'cloudflare:workers';
import {getWorkspaceUser} from '../../../auth';
import {handleRecordSave,handleRecordDelete} from '@/lib/records';
export const dynamic='force-dynamic';
async function options(){const user=await getWorkspaceUser();return {user:user?{id:user.userId,name:user.displayName}:null,db:env.DB};}
export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){return handleRecordSave(request,(await params).id,await options());}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){return handleRecordDelete(request,(await params).id,await options());}
