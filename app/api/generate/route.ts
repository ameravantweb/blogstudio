import {env} from 'cloudflare:workers';
import {getWorkspaceUser} from '../../auth';
import {streamGeneration,json} from '@/lib/generation';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const user=await getWorkspaceUser();if(!user)return json({error:'Sign in to use article generation.'},401);return streamGeneration(request,{userId:user.userId,apiKey:env.OPENAI_API_KEY,model:env.OPENAI_MODEL});}catch{return json({error:'The article service is temporarily unavailable. Your brief and existing draft are safe. Please try again.'},503);}}
