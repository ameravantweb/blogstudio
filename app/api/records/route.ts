import {env} from 'cloudflare:workers';
import {getWorkspaceUser} from '../../auth';
import {handleRecordsList} from '@/lib/records';
export const dynamic='force-dynamic';
export async function GET(request:Request){const user=await getWorkspaceUser();return handleRecordsList(request,{user:user?{id:user.userId,name:user.displayName}:null,db:env.DB});}
