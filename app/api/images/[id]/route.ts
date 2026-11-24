import {env} from 'cloudflare:workers';
import {getWorkspaceUser} from '../../../auth';
import {handleImageRead} from '@/lib/image-generation';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const user=await getWorkspaceUser();return handleImageRead((await params).id,{userId:user?.userId??null,bucket:env.BUCKET});}
