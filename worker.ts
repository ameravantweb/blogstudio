import handler from 'vinext/server/fetch-handler';
import {verifyAccess,type WorkspaceUser} from './lib/access-auth';
import {withWorkspaceUser} from './lib/access-context';

const worker={
  async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
    let user:WorkspaceUser|null=null;
    // Compiled out of production builds; the dev server listens only on loopback.
    if(import.meta.env.DEV&&['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname)&&env.LOCAL_DEV_EMAIL){
      const email=env.LOCAL_DEV_EMAIL.trim().toLowerCase();
      user={userId:email,email,displayName:email,fullName:null};
    }else{
      user=await verifyAccess(request.headers,env);
    }
    if(!user)return new Response('Private workspace. Sign in through the configured Cloudflare Access hostname. The owner must finish Access setup before this site can be used.',{
      status:403,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},
    });
    const pathname=new URL(request.url).pathname;
    const staticAsset=pathname.startsWith('/_next/static/')||['/favicon.svg','/file.svg','/globe.svg','/window.svg'].includes(pathname);
    const response=!import.meta.env.DEV&&staticAsset&&env.ASSETS
      ?await env.ASSETS.fetch(request)
      :await withWorkspaceUser(user,()=>handler.fetch(request,env,ctx));
    // Authenticated pages, API responses and generated assets must not enter shared caches.
    const secured=new Response(response.body,response);
    secured.headers.set('Cache-Control','private, no-store');
    secured.headers.set('X-Content-Type-Options','nosniff');
    return secured;
  },
};
export default worker;
