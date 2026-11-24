import {currentWorkspaceUser} from '@/lib/access-context';
import type {WorkspaceUser} from '@/lib/access-auth';

export async function getWorkspaceUser():Promise<WorkspaceUser|null>{return currentWorkspaceUser();}
export async function requireWorkspaceUser():Promise<WorkspaceUser>{
  const user=await getWorkspaceUser();
  if(!user)throw new Error('Private sign-in is required. Open the configured Cloudflare Access hostname.');
  return user;
}
