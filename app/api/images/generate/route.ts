import {env} from 'cloudflare:workers';
import {getWorkspaceUser} from '../../../auth';
import {streamTask,json} from '@/lib/generation';
import {handleImageGeneration} from '@/lib/image-generation';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{const user=await getWorkspaceUser();if(!user)return json({error:'Sign in to generate an image.'},401);return streamTask(()=>handleImageGeneration(request,{userId:user.userId,apiKey:env.OPENAI_API_KEY,model:env.OPENAI_IMAGE_MODEL,bucket:env.BUCKET}));}catch{return json({error:'The image service is unavailable. Your article is safe.'},503);}}
