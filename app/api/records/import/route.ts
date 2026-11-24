import {env} from 'cloudflare:workers';
import {getWorkspaceUser} from '../../../auth';
import {handleRecordsImport} from '@/lib/records';
export const dynamic='force-dynamic';
export async function POST(request:Request){const user=await getWorkspaceUser();return handleRecordsImport(request,{user:user?{id:user.userId,name:user.displayName}:null,db:env.DB});}
