import {env} from 'cloudflare:workers';
import {getWorkspaceUser} from '../../auth';
import {json} from '@/lib/generation';
export const dynamic='force-dynamic';
export async function GET(){const user=await getWorkspaceUser();if(!user)return json({error:'Sign in to use this studio.'},401);return json({ready:!!env.OPENAI_API_KEY});}
