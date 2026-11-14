// Real authorization functions and file handler, with synthetic external-service doubles.
// This is NOT a substitute for PostgreSQL or browser end-to-end verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {tokenHash} from '../lib/password.mjs';
process.env.SESSION_SECRET='synthetic-test-secret-'.repeat(3);
const ids={a:'00000000-0000-4000-8000-000000000001',b:'00000000-0000-4000-8000-000000000002',ticket:'00000000-0000-4000-8000-000000000003',file:'00000000-0000-4000-8000-000000000004'};
const fixtures={users:{a:{id:'user-a',platform_admin:false},b:{id:'user-b',platform_admin:false},admin:{id:'admin',platform_admin:true}},active:'a',status:'active',role:'owner',enabled:true,allowed:true,private:false,revoked:false,expired:false,disabled:false,blobReads:0,rateAllowed:true,cookieCleared:false,sessionRevoked:false};
function sql(strings,...v){const q=strings.join('?').toLowerCase();
 if(q.includes('delete from sessions')){assert.equal(v[0],tokenHash('synthetic-'+fixtures.active));fixtures.sessionRevoked=true;return Promise.resolve([])}

 if(q.includes('from sessions')){const u=fixtures.users[fixtures.active];return Promise.resolve(u&&!fixtures.expired&&!fixtures.disabled&&!fixtures.sessionRevoked&&v[0]===tokenHash('synthetic-'+fixtures.active)?[u]:[])}
 if(q.includes('insert into rate_limits'))return Promise.resolve(fixtures.rateAllowed?[{key:'test'}]:[]);
 if(q.includes('from companies c left join memberships')){const u=fixtures.users[fixtures.active];const company=v[1]==='company-a'?ids.a:ids.b;const member=u?.id==='user-a'&&company===ids.a||u?.id==='user-b'&&company===ids.b;return Promise.resolve(u&&(u.platform_admin||member&&!fixtures.revoked)?[{id:company,slug:v[1],status:fixtures.status,role:fixtures.role}]:[])}
 if(q.includes('from modules'))return Promise.resolve(fixtures.enabled?[{allowed_roles:fixtures.allowed?['owner','read-only user','staff member']:[]}]:[]);
 if(q.includes('from tickets t')){const u=fixtures.users[fixtures.active];return Promise.resolve(v[1]===ids.ticket&&u&&(u.platform_admin||u.id==='user-a'&&!fixtures.revoked)?[{id:ids.ticket,company_id:ids.a,slug:'company-a',role:fixtures.role}]:[])}
 if(q.includes('from files f'))return Promise.resolve(v[0]===ids.file?[{id:ids.file,company_id:ids.a,message_id:'message-a',name:'synthetic.pdf',mime:'application/pdf',slug:'company-a',ticket_id:ids.ticket,private:fixtures.private}]:[]);
 if(q.includes('select data from files')){fixtures.blobReads++;assert.equal(v[0],ids.file);assert.equal(v[1],ids.a);return Promise.resolve([{data:Buffer.from('%PDF-synthetic')}])}
 throw Error('Unexpected fixture query');
}
globalThis.__portalTest={sql,clearCookie:()=>{fixtures.cookieCleared=true},cookie:()=>fixtures.active&&!fixtures.cookieCleared?{value:'synthetic-'+fixtures.active}:undefined};
const modules={
 'next/headers':`export async function cookies(){return {get:()=>globalThis.__portalTest.cookie(),delete:()=>globalThis.__portalTest.clearCookie()}}`,
 'next/navigation':`export function redirect(){throw Error('REDIRECT')} export function notFound(){throw Error('NOT_FOUND')}`,
 'portal-test:db':`export function db(){return globalThis.__portalTest.sql}`,
};
registerHooks({resolve(s,c,next){if(s.endsWith('/db.mjs'))return {url:'portal-test:db',shortCircuit:true};if(s in modules)return {url:s,shortCircuit:true};return next(s,c)},load(url,c,next){if(url in modules)return {format:'module',source:modules[url],shortCircuit:true};return next(url,c)}});
const auth=await import('../lib/auth.mjs');
const {GET}=await import('../app/api/files/[id]/route.js');
function reset(){Object.assign(fixtures,{active:'a',status:'active',role:'owner',enabled:true,allowed:true,private:false,revoked:false,expired:false,disabled:false,blobReads:0,rateAllowed:true,cookieCleared:false,sessionRevoked:false})}
test('anonymous users cannot enter admin or workspace',async()=>{reset();fixtures.active=null;await assert.rejects(auth.admin(),/REDIRECT/);await assert.rejects(auth.workspace('company-a'),/REDIRECT/)});
test('company members cannot enter platform admin or another company',async()=>{reset();await assert.rejects(auth.admin(),/NOT_FOUND/);await assert.rejects(auth.workspace('company-b'),/NOT_FOUND/);await assert.rejects(auth.ticketAccess('00000000-0000-4000-8000-000000000099'),/NOT_FOUND/)});
test('suspended, archived and revoked membership deny access',async()=>{for(const state of ['suspended','archived']){reset();fixtures.status=state;await assert.rejects(auth.workspace('company-a'),/NOT_FOUND/)}reset();fixtures.revoked=true;await assert.rejects(auth.workspace('company-a'),/NOT_FOUND/)});
test('disabled modules, denied roles and read-only support writes fail closed',async()=>{reset();fixtures.enabled=false;await assert.rejects(auth.ticketAccess(ids.ticket,true),/NOT_FOUND/);reset();fixtures.allowed=false;await assert.rejects(auth.workspace('company-a','support-tickets'),/NOT_FOUND/);reset();fixtures.role='read-only user';await assert.rejects(auth.ticketAccess(ids.ticket,true),/NOT_FOUND/);await auth.ticketAccess(ids.ticket,false)});
test('expired sessions and disabled accounts cannot authenticate',async()=>{reset();fixtures.expired=true;await assert.rejects(auth.requireUser(),/REDIRECT/);reset();fixtures.disabled=true;await assert.rejects(auth.requireUser(),/REDIRECT/)});
test('authorized download is private and sandboxed',async()=>{reset();const r=await GET(new Request('http://localhost'),{params:Promise.resolve({id:ids.file})});assert.equal(r.status,200);assert.equal(fixtures.blobReads,1);assert(r.headers.get('cache-control').includes('no-store'));assert(r.headers.get('content-security-policy').includes('sandbox'));assert(r.headers.get('content-disposition').startsWith('attachment'))});
test('foreign company, private note and disabled-module downloads never read blob',async()=>{for(const patch of [{active:'b'},{private:true},{enabled:false},{revoked:true}]){reset();Object.assign(fixtures,patch);await assert.rejects(GET(new Request('http://localhost'),{params:Promise.resolve({id:ids.file})}),/NOT_FOUND/);assert.equal(fixtures.blobReads,0)}});
test('platform administrator can download internal note attachments',async()=>{reset();fixtures.active='admin';fixtures.private=true;const r=await GET(new Request('http://localhost'),{params:Promise.resolve({id:ids.file})});assert.equal(r.status,200)});
test('download throttle fails closed without materializing data',async()=>{reset();fixtures.rateAllowed=false;const r=await GET(new Request('http://localhost'),{params:Promise.resolve({id:ids.file})});assert.equal(r.status,429);assert.equal(fixtures.blobReads,0)});

test('logout invalidates the database token and clears the cookie',async()=>{reset();await auth.requireUser();const {revokeCurrentSession}=await import('../lib/session.mjs');await revokeCurrentSession();assert(fixtures.sessionRevoked);assert(fixtures.cookieCleared);await assert.rejects(auth.requireUser(),/REDIRECT/);fixtures.cookieCleared=false;await assert.rejects(auth.requireUser(),/REDIRECT/)});

test('payment module remains server-blocked even when fixture module settings are enabled',async()=>{
 reset();
 await assert.rejects(auth.workspace('company-a','customer-payments'),/NOT_FOUND/);
});

test('selecting an unfinished trade module never permits direct-route access, including admin preview',async()=>{
 reset();
 await assert.rejects(auth.workspace('company-a','site-diaries'),/NOT_FOUND/);
 fixtures.active='admin';
 await assert.rejects(auth.workspace('company-a','site-diaries'),/NOT_FOUND/);
});
