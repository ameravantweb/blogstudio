import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=await build({entryPoints:[root+'worker.ts'],bundle:true,write:false,platform:'node',format:'esm',define:{'import.meta.env.DEV':'false'},plugins:[{
  name:'framework-test-handler',setup(builder){
    builder.onResolve({filter:/^vinext\/server\/fetch-handler$/},()=>({path:'handler',namespace:'test'}));
    builder.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`import {currentWorkspaceUser} from ${JSON.stringify(root+'lib/access-context.ts')};export default {async fetch(){await Promise.resolve();return new Response(JSON.stringify({user:currentWorkspaceUser()}),{headers:{'Content-Type':'application/json'}});}};`,loader:'ts',resolveDir:root}));
  },
}]});
const worker=(await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'))).default;
const {privateKey,publicKey}=await generateKeyPair('RS256');
const jwk={...await exportJWK(publicKey),kid:'worker-fixture',alg:'RS256'};
const env={CF_ACCESS_TEAM_DOMAIN:'https://worker-tests.cloudflareaccess.com',CF_ACCESS_AUD:'studio-app',ALLOWED_EMAILS:'alice@example.com,bob@example.com',LOCAL_DEV_EMAIL:'alice@example.com'};
async function jwt(email){return new SignJWT({email,type:'app'}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setIssuer(env.CF_ACCESS_TEAM_DOMAIN).setAudience(env.CF_ACCESS_AUD).setSubject(email).setIssuedAt().setExpirationTime('5m').sign(privateKey);}
test('production Worker protects pages, APIs and assets, ignores local-dev identity and carries only verified request identity',async()=>{
  const originalFetch=globalThis.fetch;let assets=0;
  globalThis.fetch=async url=>{assert.equal(String(url),env.CF_ACCESS_TEAM_DOMAIN+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
  const bound={...env,ASSETS:{async fetch(){assets++;return new Response('private-image');}}};
  try{
    for(const path of ['/','/workspace','/api/records','/api/images/a','/_next/static/main.js','/favicon.svg']){
      const denied=await worker.fetch(new Request('http://localhost'+path,{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'alice@example.com','Cf-Access-Authenticated-User-Email':'alice@example.com'}}),bound,{});
      assert.equal(denied.status,403);assert.equal(denied.headers.get('Cache-Control'),'private, no-store');
    }
    assert.equal(assets,0);
    const results=await Promise.all(['alice@example.com','bob@example.com'].map(async email=>{
      const response=await worker.fetch(new Request('https://studio.example/api/records',{headers:{'Cf-Access-Jwt-Assertion':await jwt(email)}}),bound,{});
      assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');return (await response.json()).user.userId;
    }));
    assert.deepEqual(results,['alice@example.com','bob@example.com']);
    const image=await worker.fetch(new Request('https://studio.example/favicon.svg',{headers:{'Cf-Access-Jwt-Assertion':await jwt('alice@example.com')}}),bound,{});
    assert.equal(await image.text(),'private-image');assert.equal(assets,1);
  }finally{globalThis.fetch=originalFetch;}
});
