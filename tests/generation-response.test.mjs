import test from 'node:test';
import assert from 'node:assert/strict';
import {readGenerationResponse} from '../lib/generation-response.ts';
import {streamGeneration} from '../lib/generation.ts';
import {sampleBrief} from '../lib/blog.ts';
const article={title:'Test article',slug:'test-article',metaDescription:'Summary',answer:'Answer',markdown:'## Useful advice\n\n'+'Useful article guidance. '.repeat(380),faqs:[],reviewNotes:[]};
const request=()=>new Request('https://studio.example/api/generate',{method:'POST',headers:{Origin:'https://studio.example','Content-Type':'application/json'},body:JSON.stringify({brief:sampleBrief()})});
test('generation starts the response before the provider finishes and delivers the validated article',async()=>{
 let release;const provider=new Promise(resolve=>{release=resolve;});
 const response=streamGeneration(request(),{userId:'user',apiKey:'test-placeholder',fetcher:()=>provider});
 assert.match(response.headers.get('Cache-Control'),/no-store/);
 const reader=response.body.getReader();const first=await reader.read();assert.equal(JSON.parse(new TextDecoder().decode(first.value)).type,'working');
 release(new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(article)}]}]})));
 const result=await reader.read();assert.deepEqual(JSON.parse(new TextDecoder().decode(result.value)).data.article,article);assert.equal((await reader.read()).done,true);
});
test('streamed provider and authentication failures retain their readable messages',async()=>{
 const response=streamGeneration(request(),{userId:'user',apiKey:'test-placeholder',fetcher:async()=>new Response(JSON.stringify({error:{code:'insufficient_quota'}}),{status:429})});
 assert.match((await readGenerationResponse(response)).error,/billing quota/);
 const anonymous=streamGeneration(request(),{userId:null});assert.match((await readGenerationResponse(anonymous)).error,/Sign in/);
});
test('HTML gateway errors and HTML success pages never surface JSON syntax exceptions',async()=>{
 for(const status of [200,404,502,504,524]){
  await assert.rejects(readGenerationResponse(new Response('<!DOCTYPE html><html>Gateway error</html>',{status,headers:{'Content-Type':'text/html'}})),error=>/brief and existing draft are safe/.test(error.message)&&!error.message.includes('Unexpected token'));
 }
});
test('expired authentication returns a recovery instruction',async()=>{
 await assert.rejects(readGenerationResponse(new Response('<html>Sign in</html>',{status:401})),/reload this page and sign in again/);
});
test('parser handles heartbeat lines and arbitrary network chunk boundaries with UTF-8',async()=>{
 const data=JSON.stringify({type:'working'})+'\n'+JSON.stringify({type:'result',data:{article:{...article,title:'Café – practical advice'}}})+'\n';
 const bytes=new TextEncoder().encode(data);let offset=0;
 const stream=new ReadableStream({pull(controller){if(offset>=bytes.length){controller.close();return;}controller.enqueue(bytes.slice(offset,offset+3));offset+=3;}});
 assert.equal((await readGenerationResponse(new Response(stream,{headers:{'Content-Type':'application/x-ndjson'}}))).article.title,'Café – practical advice');
});
test('truncated stream and malformed JSON give a recoverable error',async()=>{
 for(const body of ['{"type":"working"}\n','{"type":"result","data":'])await assert.rejects(readGenerationResponse(new Response(body,{headers:{'Content-Type':'application/x-ndjson'}})),/existing draft are safe/);
 await assert.rejects(readGenerationResponse(new Response('{broken')),/unexpected response/);
});
test('legacy JSON success and failure responses remain supported',async()=>{
 assert.deepEqual(await readGenerationResponse(new Response(JSON.stringify({article}))),{article});
 await assert.rejects(readGenerationResponse(new Response(JSON.stringify({error:'Provider failed safely.'}),{status:502})),/Provider failed safely/);
});
