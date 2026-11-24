import {AsyncLocalStorage} from 'node:async_hooks';
import type {WorkspaceUser} from './access-auth.ts';

const users=new AsyncLocalStorage<WorkspaceUser>();
export function withWorkspaceUser<T>(user:WorkspaceUser,run:()=>T):T{return users.run(user,run);}
export function currentWorkspaceUser():WorkspaceUser|null{return users.getStore()??null;}
