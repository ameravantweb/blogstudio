import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,createLocalJWKSet,exportJWK} from 'jose';
import {verifyAccess} from '../lib/access-auth.ts';
import {withWorkspaceUser,currentWorkspaceUser} from '../lib/access-context.ts';

const {privateKey,publicKey}=await generateKeyPair('RS256');
const keys=createLocalJWKSet({keys:[{...await exportJWK(publicKey),kid:'test-key',alg:'RS256'}]});
const config={CF_ACCESS_TEAM_DOMAIN:'https://example-team.cloudflareaccess.com',CF_ACCESS_AUD:'studio-app',ALLOWED_EMAILS:'alice@example.com, bob@example.com'};
async function token(overrides={}){
  return new SignJWT({type:'app',email:'alice@example.com',name:'Alice',...overrides})
    .setProtectedHeader({alg:'RS256',kid:'test-key'})
    .setIssuer(overrides.iss??config.CF_ACCESS_TEAM_DOMAIN)
    .setAudience(overrides.aud??config.CF_ACCESS_AUD)
    .setSubject('access-user-alice').setIssuedAt().setExpirationTime(overrides.exp??'5m').sign(privateKey);
}
const header=jwt=>new Headers({'Cf-Access-Jwt-Assertion':jwt});
test('verified Access identity is bound to issuer, audience and exact approved email',async()=>{
  assert.deepEqual(await verifyAccess(header(await token()),config,keys),{userId:'alice@example.com',email:'alice@example.com',displayName:'Alice',fullName:'Alice'});
  for(const override of [{iss:'https://attacker.example'},{aud:'different-app'},{email:'outsider@example.com'},{type:'service'},{exp:1}]){
    assert.equal(await verifyAccess(header(await token(override)),config,keys),null);
  }
});
test('missing settings, spoofed identity headers, altered signatures and unsigned JWTs fail closed',async()=>{
  const jwt=await token();
  assert.equal(await verifyAccess(new Headers({'oai-authenticated-user-email':'alice@example.com','oai-authenticated-user-id':'admin','Cf-Access-Authenticated-User-Email':'alice@example.com'}),config,keys),null);
  for(const settings of [{},{...config,CF_ACCESS_AUD:''},{...config,ALLOWED_EMAILS:''},{...config,CF_ACCESS_TEAM_DOMAIN:'https://attacker.example'}])assert.equal(await verifyAccess(header(jwt),settings,keys),null);
  const [head,body,signature]=jwt.split('.');
  const altered=Buffer.from(JSON.stringify({...JSON.parse(Buffer.from(body,'base64url')),email:'bob@example.com'})).toString('base64url');
  assert.equal(await verifyAccess(header(`${head}.${altered}.${signature}`),config,keys),null);
  assert.equal(await verifyAccess(header(`${Buffer.from('{"alg":"none"}').toString('base64url')}.${body}.`),config,keys),null);
});
test('concurrent requests keep their authenticated users separate and leave no ambient identity',async()=>{
  assert.equal(currentWorkspaceUser(),null);
  const users=[{userId:'alice'},{userId:'bob'}];
  const results=await Promise.all(users.map(user=>withWorkspaceUser(user,async()=>{
    await new Promise(resolve=>setTimeout(resolve,user.userId==='alice'?10:1));return currentWorkspaceUser();
  })));
  assert.deepEqual(results,users);assert.equal(currentWorkspaceUser(),null);
});
