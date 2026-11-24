import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';

export type WorkspaceUser={userId:string;displayName:string;email:string;fullName:string|null};
export type AccessConfig={CF_ACCESS_TEAM_DOMAIN?:string;CF_ACCESS_AUD?:string;ALLOWED_EMAILS?:string};
const keySets=new Map<string,ReturnType<typeof createRemoteJWKSet>>();

/** All identity fields come from a verified, audience-bound Access application JWT. */
export async function verifyAccess(headers:Headers,config:AccessConfig,keySet?:JWTVerifyGetKey):Promise<WorkspaceUser|null>{
  try{
    const domain=new URL(config.CF_ACCESS_TEAM_DOMAIN||'');
    if(domain.protocol!=='https:'||!domain.hostname.endsWith('.cloudflareaccess.com')||domain.username||domain.password||domain.port||domain.search||domain.hash||domain.pathname!=='/')return null;
    const audience=config.CF_ACCESS_AUD?.trim();
    const allowed=new Set(config.ALLOWED_EMAILS?.split(',').map(email=>email.trim().toLowerCase()).filter(Boolean));
    const token=headers.get('Cf-Access-Jwt-Assertion');
    if(!audience||!allowed.size||!token||token.length>16000)return null;
    const issuer=domain.origin;
    let keys:JWTVerifyGetKey|undefined=keySet??keySets.get(issuer);
    if(!keys){const remote=createRemoteJWKSet(new URL('/cdn-cgi/access/certs',issuer));keySets.set(issuer,remote);keys=remote;}
    const {payload}=await jwtVerify(token,keys,{issuer,audience,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email'],clockTolerance:5});
    if(typeof payload.email!=='string'||typeof payload.sub!=='string'||!payload.sub||payload.type!=='app')return null;
    const email=payload.email.trim().toLowerCase();
    if(!allowed.has(email))return null;
    const name=typeof payload.name==='string'&&payload.name.trim()?payload.name.trim():null;
    return {userId:email,email,displayName:name??email,fullName:name};
  }catch{return null;}
}
