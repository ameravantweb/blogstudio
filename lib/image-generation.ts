import type {ArticleImage} from './blog.ts';
import {boundedBody,json} from './generation.ts';

type ImageStore = {put:(key:string,value:Uint8Array,options:{httpMetadata:{contentType:string}})=>Promise<unknown>;get:(key:string)=>Promise<{body:ReadableStream;size:number}|null>};
type Options={userId:string|null;apiKey?:string;model?:string;bucket?:ImageStore;fetcher?:typeof fetch};
const imageId=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export async function imageKey(_userId:string,id:string){return `article-images/${id}.webp`;}
export async function handleImageGeneration(request:Request,options:Options){
  if(!options.userId)return json({error:'Sign in to generate an article image.'},401);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Generate images from this site.'},403);
  if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return json({error:'Use a JSON image request.'},415);
  let prompt:string,title:string;
  try{const data=JSON.parse(await boundedBody(request,15000));if(typeof data.prompt!=='string'||!data.prompt.trim()||data.prompt.length>3000||typeof data.title!=='string'||!data.title.trim()||data.title.length>500)throw new Error('Add an image prompt (up to 3,000 characters) and an article title.');prompt=data.prompt.trim();title=data.title.trim();}catch(e){return json({error:e instanceof Error?e.message:'The image request is invalid.'},400);}
  if(!options.apiKey)return json({error:'The OpenAI image connection is not configured. Your article is saved.'},503);
  if(!options.bucket)return json({error:'Private image storage is not available. Your article is saved; try image generation again later.'},503);
  try{
    const response=await (options.fetcher??fetch)('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:`Bearer ${options.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:options.model||'gpt-image-1.5',prompt:`Create one featured image for a client blog article. Use the following visual brief. Do not include lettering, logos, or watermarks.\n${prompt}`,n:1,size:'1536x1024',quality:'medium',output_format:'webp',output_compression:80,background:'opaque'}),signal:AbortSignal.timeout(240000)});
    if(!response.ok){
      const failure=await response.json().catch(()=>({})) as {error?:{code?:string;type?:string}};
      if(response.status===429){
        if(failure.error?.code==='credit_balance_exhausted'||failure.error?.type==='insufficient_quota')return json({error:'The connected API project has no available image credits or has reached its billing limit. Your article and existing image are safe.'},503);
        return json({error:'Image generation is at its request limit. Your article is saved; wait before trying again.'},429);
      }
      if(failure.error?.code==='content_policy_violation')return json({error:'The image service could not fulfill this prompt. Revise the visual brief. Your article is saved.'},422);
      if(response.status===401||response.status===403)return json({error:'The API key does not currently have access to image generation. The site owner may need to enable image-model access or verify the API organization. Your article is saved.'},502);
      return json({error:'The image service could not generate this image. Your article and existing image are safe.'},502);
    }
    const result=await response.json() as {data?:{b64_json?:string}[]};const b64=result.data?.[0]?.b64_json;
    if(typeof b64!=='string'||b64.length>16000000||!b64.length)throw new Error('invalid');
    const binary=atob(b64);const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
    if(binary.slice(0,4)!=='RIFF'||binary.slice(8,12)!=='WEBP')throw new Error('invalid');
    const id=crypto.randomUUID();await options.bucket.put(await imageKey(options.userId,id),bytes,{httpMetadata:{contentType:'image/webp'}});
    const image:ArticleImage={id,url:`/api/images/${id}`,alt:`Editorial illustration for ${title}`,prompt,createdAt:new Date().toISOString(),width:1536,height:1024};return json({image});
  }catch(e){return json({error:e instanceof Error&&e.name==='TimeoutError'?'Image generation timed out. Your article and existing image are safe; wait before trying again.':'The image could not be generated or saved. Your article and existing image are safe.'},502);}
}
export async function handleImageRead(id:string,options:Pick<Options,'userId'|'bucket'>){
  if(!options.userId)return json({error:'Sign in to view this image.'},401);
  if(!imageId.test(id))return json({error:'Image not found.'},404);
  if(!options.bucket)return json({error:'Image storage is unavailable.'},503);
  try{const file=await options.bucket.get(await imageKey(options.userId,id));if(!file)return json({error:'Image not found for this account.'},404);return new Response(file.body,{headers:{'Content-Type':'image/webp','Content-Length':String(file.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});}catch{return json({error:'The image could not be loaded. Try again later.'},503);}
}
