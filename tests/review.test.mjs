import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordHash,verifyPassword,passwordInput} from '../lib/password.mjs';
import {canWrite,canAssignRole} from '../lib/catalog.mjs';
import {brandColors,contrast} from '../lib/branding.mjs';
import {csp,securityHeaders} from '../lib/security-headers.mjs';
import {queryFilters} from '../lib/filters.mjs';
test('passwords preserve surrounding spaces and enforce consistent bounds',async()=>{
 const value='  synthetic password  ';
 const hash=await passwordHash(value);
 assert(await verifyPassword(value,hash));
 assert(!await verifyPassword(value.trim(),hash));
 assert.throws(()=>passwordInput('x'.repeat(257)));
 await assert.rejects(passwordHash('x'.repeat(257)));
 await assert.rejects(passwordHash('short'));
});
test('legacy hashes can be verified for migration on successful login',async()=>{
 const {scryptSync}=await import('node:crypto');
 const salt='ab'.repeat(16),password='synthetic legacy password';
 const hash=salt+':'+scryptSync(password,salt,64).toString('hex');
 assert(await verifyPassword(password,hash));
 assert(!await verifyPassword('incorrect',hash));
});
test('unknown roles fail closed',()=>{assert.equal(canWrite('invented'),false)});
test('brand controls and links meet AA text contrast over sample colours',()=>{
 for(const colour of ['#ffffff','#000000','#b85b30','#ffff00','#00ff00','#123456','#ff00ff']){
  const palette=brandColors(colour);
  assert(contrast(palette.accent,palette.text)>=4.5);
  assert(contrast(palette.link,'#ffffff')>=4.5);
 }
});
test('production CSP blocks unrestricted script execution and foreign submission',()=>{
 const policy=csp('syntheticNonce123');
 const script=policy.split('; ').find(x=>x.startsWith('script-src'));
 assert(!script.includes('unsafe-inline'));assert(!script.includes('unsafe-eval'));
 assert(policy.includes("form-action 'self'"));assert(policy.includes("frame-ancestors 'none'"));
 assert(policy.includes("object-src 'none'"));assert(policy.includes('upgrade-insecure-requests'));
 assert.throws(()=>csp("<script>"));
 assert(securityHeaders.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex')));
});
test('query filters bound input and reject malformed dates and arrays',()=>{
 const q=queryFilters({q:'x'.repeat(500),from:'2026-02-31',to:'not-a-date',status:['Open'],company:'bad-id'});
 assert.equal(q.q.length,180);assert.equal(q.from,'');assert.equal(q.to,'');assert.equal(q.status,'');assert.equal(q.company,'');
 assert.equal(queryFilters({from:'2026-11-14'}).from,'2026-11-14');
});

test('managers cannot promote themselves to owner or replace an owner role',()=>{assert(!canAssignRole('manager','manager','owner'));assert(!canAssignRole('manager','owner','staff member'));assert(canAssignRole('owner','manager','owner'));assert(!canAssignRole('staff member','staff member','manager'))});

test('attachment filename is inert metadata with a matching type extension',async()=>{const {upload}=await import('../lib/uploads.mjs');const f=await upload(new File(['%PDF-synthetic'],'../../unsafe.exe'));assert(f.name.endsWith('.pdf'));assert(!f.name.includes('/'));assert(!f.name.includes('\r'));await assert.rejects(upload('not-a-file'));});

test('action errors discard provider details and preserve framework redirects',async()=>{
 const {rethrowActionError}=await import('../lib/action-errors.mjs');
 assert.throws(()=>rethrowActionError(new Error('synthetic confidential detail')),error=>!error.message.includes('confidential')&&!error.cause);
 const redirect={digest:'NEXT_REDIRECT;replace;/login;307;'};
 assert.throws(()=>rethrowActionError(redirect),error=>error===redirect);
});
