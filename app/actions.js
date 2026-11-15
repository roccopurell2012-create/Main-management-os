'use server';
import {prepareInitialWorkspace} from '../lib/initial-workspace.mjs';
import {revokeCurrentSession} from '../lib/session.mjs';
import { rethrowActionError } from '../lib/action-errors.mjs';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '../lib/db.mjs';
import { admin, requireUser, workspace, ticketAccess } from '../lib/auth.mjs';
import { passwordHash, verifyPassword, tokenHash, passwordInput, DUMMY_HASH } from '../lib/password.mjs';
import { roles, statuses, priorities, categories, catalog, canAssignRole, canSelectModule, defaultModuleSelection } from '../lib/catalog.mjs';
import { rateLimit, limitWrite } from '../lib/rate-limit.mjs';
import { upload } from '../lib/uploads.mjs';
const text = (f, k, max = 500) => z.string().trim().min(1).max(max).parse(f.get(k));
const id = (f, k) => z.uuid().parse(f.get(k));
async function audit(tx, u, c, action) { await tx `insert into audit_events(actor_id,company_id,action) values(${u.id},${c},${action})`; }
export async function login(f) {
    let loginStage = 'validate-input', loginPath = '/login';
    try {
        const email = z.email().max(254).parse(text(f, 'email', 254)).toLowerCase(), password = passwordInput(f.get('password'));
        const companySlug = f.get('companySlug') ? z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(70).parse(f.get('companySlug')) : null;
        loginPath = companySlug ? '/c/' + companySlug + '/login' : '/login';
        loginStage = 'rate-limit';
        const source = process.env.VERCEL === '1' ? (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() : 'local';
        if (!await rateLimit('login-global', 'all', 120, 60) || !await rateLimit('login-source', source || 'unknown', 20, 60) || !await rateLimit('login-email', email, 10, 900))
            redirect(loginPath + '?error=rate');
        loginStage = 'user-lookup';
        const sql = db(), [u] = await sql `select * from users where email=${email} and not disabled`;
        loginStage = 'password-check';
        const valid = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
        if (!u || !valid)
            redirect(loginPath + '?error=invalid');
        if (companySlug) {
            loginStage = 'company-membership';
            const [access] = await sql `select c.id from companies c where c.slug=${companySlug} and c.status='active' and (${u.platform_admin} or exists(select 1 from memberships m where m.company_id=c.id and m.user_id=${u.id}))`;
            if (!access)
                redirect(loginPath + '?error=invalid');
        }
        if (!u.password_hash.startsWith('scrypt-v1:'))
            await sql `update users set password_hash=${await passwordHash(password)} where id=${u.id}`;
        loginStage = 'session-write';
        const rememberMe = f.get('rememberMe') === 'on';
        const sessionSeconds = rememberMe ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
        const token = randomBytes(32).toString('hex');
        await sql `insert into sessions(token_hash,user_id,expires_at) values(${tokenHash(token)},${u.id},now()+(${sessionSeconds} * interval '1 second'))`;
        (await cookies()).set('portal_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: sessionSeconds });
        redirect(companySlug ? '/c/' + companySlug : '/');
    }
    catch (error) {
        if (!(typeof error?.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT;'))) {
            console.error('login-action-failed', {
                stage: loginStage,
                name: typeof error?.name === 'string' ? error.name : 'Error',
                code: typeof error?.code === 'string' ? error.code : undefined,
                causeCode: typeof error?.cause?.code === 'string' ? error.cause.code : undefined
            });
        }
        rethrowActionError(error);
    }
}
export async function logout() {
    try { await revokeCurrentSession(); redirect('/login'); }
    catch(error) { rethrowActionError(error); }
}
export async function saveCompany(f) {
    try {
        const u = await admin();
        await limitWrite(u.id, 'platform', 'company');
        const companyId = f.get('id') ? id(f, 'id') : null;
        const name = text(f, 'name', 120), slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(70).parse(text(f, 'slug')), color = z.string().regex(/^#[0-9a-fA-F]{6}$/).parse(f.get('color')), status = z.enum(['active', 'suspended', 'archived']).parse(f.get('status')), contact = String(f.get('contact') ?? '').slice(0, 500), welcome = String(f.get('welcome') ?? '').slice(0, 1000), timezone = text(f, 'timezone', 100);
        new Intl.DateTimeFormat('en', { timeZone: timezone });
        const logo = await upload(f.get('logo'), true);
        await db().begin(async (tx) => {
            let c;
            if (companyId) {
                [c] = await tx `update companies set name=${name},slug=${slug},color=${color},status=${status},contact=${contact},welcome=${welcome},timezone=${timezone} where id=${companyId} returning *`;
            }
            else {
                [c] = await tx `insert into companies(name,slug,color,status,contact,welcome,timezone) values(${name},${slug},${color},${status},${contact},${welcome},${timezone}) returning *`;
                for (const selection of defaultModuleSelection())
                    await tx `insert into modules(company_id,module_id,enabled) values(${c.id},${selection.moduleId},${selection.selected})`;
            }
            if (!c)
                throw Error('Company not found');
            if (logo) {
                const [file] = await tx `insert into files(company_id,name,mime,data) values(${c.id},${logo.name},${logo.mime},${logo.data}) returning id`;
                await tx `update companies set logo_id=${file.id} where id=${c.id}`;
            }
            await audit(tx, u, c.id, 'Company details saved: ' + status);
        });
        revalidatePath('/', 'layout');
        redirect('/admin');
    }
    catch (error) {
        rethrowActionError(error);
    }
}
export async function toggleModule(f) {
    try {
        const u = await admin(), company = id(f, 'company'), moduleId = text(f, 'module');
        if (!catalog.some(item => item.id === moduleId) || !canSelectModule(moduleId))
            throw Error('This module cannot be enabled');
        await limitWrite(u.id, company, 'module-toggle');
        const enabled = f.get('enabled') === 'on';
        await db().begin(async (tx) => {
            await tx `insert into modules(company_id,module_id,enabled) values(${company},${moduleId},${enabled}) on conflict(company_id,module_id) do update set enabled=excluded.enabled`;
            await audit(tx, u, company, 'Module ' + (enabled ? 'enabled: ' : 'disabled: ') + moduleId);
        });
        revalidatePath('/', 'layout');
    } catch (error) { rethrowActionError(error); }
}
export async function saveModule(f) {
    try {
        const u = await admin(), company = id(f, 'company'), moduleId = text(f, 'module');
        const m = catalog.find(x => x.id === moduleId);
        if (!m || !canSelectModule(moduleId))
            throw Error('Website payment collection is disabled');
        const allowed = f.getAll('roles').map(r => z.enum(roles).parse(r));
        const settings = z.record(z.string(), z.unknown()).parse(JSON.parse(String(f.get('settings') || '{}')));
        await db().begin(async (tx) => { await tx `insert into modules(company_id,module_id,enabled,allowed_roles,settings) values(${company},${moduleId},${f.get('enabled') === 'on'},${allowed},${tx.json(settings)}) on conflict(company_id,module_id) do update set enabled=excluded.enabled,allowed_roles=excluded.allowed_roles,settings=excluded.settings`; await audit(tx, u, company, 'Module updated: ' + moduleId); });
        revalidatePath('/', 'layout');
    }
    catch (error) {
        rethrowActionError(error);
    }
}
export async function saveMember(f) {
    try {
        const u = await requireUser(), company = id(f, 'company');
        if (!u.platform_admin) {
            const [c] = await db() `select slug from companies where id=${company}`;
            if (!c)
                throw Error('Unavailable');
            await workspace(c.slug, 'team-and-permissions', true, true);
        }
        const email = z.email().parse(text(f, 'email', 254)).toLowerCase(), name = text(f, 'name', 120), role = z.enum(roles).parse(f.get('role')), password = String(f.get('password') || '');
        if (password)
            passwordInput(password, 14);
        await limitWrite(u.id, company, 'membership');
        await db().begin(async (tx) => {
            let [member] = await tx `select id from users where email=${email}`;
            if (member && !u.platform_admin) {
                const [enrolled] = await tx `select user_id from memberships where company_id=${company} and user_id=${member.id}`;
                if (!enrolled)
                    throw Error('Ask the platform administrator to enroll an existing account');
            }
            if (!member) {
                if (password.length < 14)
                    throw Error('New accounts require a password of at least 14 characters');
                [member] = await tx `insert into users(email,name,password_hash) values(${email},${name},${await passwordHash(password)}) returning id`;
            }
            if (!u.platform_admin) {
                const { role: actorRole } = await workspace((await tx `select slug from companies where id=${company}`)[0].slug, 'team-and-permissions', true, true);
                const [existing] = await tx `select role from memberships where company_id=${company} and user_id=${member.id}`;
                if (!canAssignRole(actorRole, existing?.role, role))
                    throw Error('Only a company owner can manage owner membership');
            }
            await tx `insert into memberships(company_id,user_id,role) values(${company},${member.id},${role}) on conflict(company_id,user_id) do update set role=excluded.role`;
            await audit(tx, u, company, 'Membership saved');
        });
        revalidatePath('/', 'layout');
    }
    catch (error) {
        rethrowActionError(error);
    }
}
export async function removeMember(f) {
    try {
        const u = await admin(), company = id(f, 'company'), member = id(f, 'member');
        await db().begin(async (tx) => { await tx `delete from memberships where company_id=${company} and user_id=${member}`; await audit(tx, u, company, 'Membership removed'); });
        revalidatePath('/', 'layout');
    }
    catch (error) {
        rethrowActionError(error);
    }
}
async function notify(tx, company, ticket, actor, title) { await tx `insert into notifications(company_id,ticket_id,user_id,title) select ${company},${ticket},u.id,${title} from users u where not u.disabled and u.id<>${actor} and (u.platform_admin or exists(select 1 from memberships m where m.user_id=u.id and m.company_id=${company}))`; }
export async function openTicket(f) {
    try {
        const { u, c } = await workspace(text(f, 'slug'), 'support-tickets', true);
        await limitWrite(u.id, c.id, 'support');
        const subject = text(f, 'subject', 180), body = text(f, 'body', 15000), priority = z.enum(priorities).parse(f.get('priority')), category = z.enum(categories).parse(f.get('category')), file = await upload(f.get('attachment'));
        let ticket;
        await db().begin(async (tx) => {
            [ticket] = await tx `insert into tickets(company_id,subject,category,priority,created_by) values(${c.id},${subject},${category},${priority},${u.id}) returning id`;
            const [m] = await tx `insert into messages(ticket_id,company_id,author_id,body) values(${ticket.id},${c.id},${u.id},${body}) returning id`;
            if (file)
                await tx `insert into files(company_id,message_id,name,mime,data) values(${c.id},${m.id},${file.name},${file.mime},${file.data})`;
            await notify(tx, c.id, ticket.id, u.id, 'New support ticket');
            await audit(tx, u, c.id, 'Support ticket opened');
        });
        redirect('/c/' + c.slug + '/support-tickets/' + ticket.id);
    }
    catch (error) {
        rethrowActionError(error);
    }
}
export async function reply(f) {
    try {
        const { u, t } = await ticketAccess(id(f, 'ticket'), true), body = text(f, 'body', 15000), privateNote = f.get('private') === 'on';
        if (privateNote && !u.platform_admin)
            throw Error('Not permitted');
        await limitWrite(u.id, t.company_id, 'support');
        const file = await upload(f.get('attachment'));
        await db().begin(async (tx) => {
            const [m] = await tx `insert into messages(ticket_id,company_id,author_id,body,private) values(${t.id},${t.company_id},${u.id},${body},${privateNote}) returning id`;
            if (file)
                await tx `insert into files(company_id,message_id,name,mime,data) values(${t.company_id},${m.id},${file.name},${file.mime},${file.data})`;
            await tx `update tickets set updated_at=now() where id=${t.id}`;
            if (!privateNote)
                await notify(tx, t.company_id, t.id, u.id, 'Support reply received');
            await audit(tx, u, t.company_id, privateNote ? 'Internal note added' : 'Support reply added');
        });
        revalidatePath('/', 'layout');
    }
    catch (error) {
        rethrowActionError(error);
    }
}
export async function updateTicket(f) {
    try {
        const { u, t } = await ticketAccess(id(f, 'ticket'), true);
        await limitWrite(u.id, t.company_id, 'support');
        const status = z.enum(statuses).parse(f.get('status'));
        if (!u.platform_admin && !['Open', 'Resolved'].includes(status))
            throw Error('Only support can set this status');
        await db().begin(async (tx) => {
            if (u.platform_admin) {
                const priority = z.enum(priorities).parse(f.get('priority')), assigned = f.get('assigned') ? id(f, 'assigned') : null;
                if (assigned) {
                    const [a] = await tx `select id from users where id=${assigned} and platform_admin and not disabled`;
                    if (!a)
                        throw Error('Invalid administrator');
                }
                await tx `update tickets set status=${status},priority=${priority},assigned_to=${assigned},updated_at=now() where id=${t.id}`;
            }
            else
                await tx `update tickets set status=${status},updated_at=now() where id=${t.id}`;
            await audit(tx, u, t.company_id, 'Ticket status: ' + status);
        });
        revalidatePath('/', 'layout');
    }
    catch (error) {
        rethrowActionError(error);
    }
}
export async function markRead() {
    try {
        const u = await requireUser();
        await db() `update notifications set read_at=now() where user_id=${u.id} and read_at is null`;
        revalidatePath('/', 'layout');
    }
    catch (error) {
        rethrowActionError(error);
    }
}
export async function changePassword(f) {
    try {
        const u = await requireUser(), current = passwordInput(f.get('current')), next = z.string().min(14).max(256).parse(f.get('next'));
        if (!await rateLimit('password-change', u.id, 5, 900))
            throw Error('Please wait before trying again');
        if (!await verifyPassword(current, u.password_hash))
            throw Error('Current password is incorrect');
        await db().begin(async (tx) => { await tx `update users set password_hash=${await passwordHash(next)} where id=${u.id}`; await tx `delete from sessions where user_id=${u.id}`; await audit(tx, u, null, 'Password changed; sessions revoked'); });
        (await cookies()).delete('portal_session');
        redirect('/login');
    }
    catch (error) {
        rethrowActionError(error);
    }
}

export async function deleteCompany(f) {
    try {
        const u = await admin();
        await limitWrite(u.id, 'platform', 'company-delete');
        const companyId = id(f, 'company');
        const confirmSlug = z.string().trim().min(1).max(70).parse(f.get('confirmSlug'));
        await db().begin(async (tx) => {
            const [c] = await tx `select id,slug from companies where id=${companyId} for update`;
            if (!c || c.slug !== confirmSlug)
                throw Error('Company confirmation did not match');
            await tx `delete from business_records where company_id=${c.id}`;
            await tx `delete from notifications where company_id=${c.id}`;
            await tx `delete from files where company_id=${c.id}`;
            await tx `delete from messages where company_id=${c.id}`;
            await tx `delete from tickets where company_id=${c.id}`;
            await tx `delete from modules where company_id=${c.id}`;
            await tx `delete from memberships where company_id=${c.id}`;
            await tx `delete from audit_events where company_id=${c.id}`;
            await tx `delete from companies where id=${c.id}`;
            await audit(tx, u, null, 'Company deleted');
        });
        revalidatePath('/', 'layout');
        redirect('/admin');
    }
    catch (error) {
        rethrowActionError(error);
    }
}
export async function setupInitialWorkspace() {
  try {
    const u=await admin();
    await limitWrite(u.id,'platform','company');
    const result=await prepareInitialWorkspace(db(),u);
    revalidatePath('/','layout');
    redirect('/admin/company/'+result.company.id);
  } catch(error) {rethrowActionError(error)}
}

export async function saveBusinessRecord(f) {
    try {
        const slug=text(f,'slug',70), moduleId=text(f,'module',100), {u,c}=await workspace(slug,moduleId,true);
        await limitWrite(u.id,c.id,'business-record');
        const recordId=f.get('record')?id(f,'record'):null, title=text(f,'title',180);
        const data={title,reference:String(f.get('reference')??'').trim().slice(0,100),contact:String(f.get('contact')??'').trim().slice(0,160),status:String(f.get('status')??'Open').trim().slice(0,60)||'Open',date:String(f.get('date')??'').slice(0,10),amount:String(f.get('amount')??'').trim().slice(0,30),description:String(f.get('description')??'').trim().slice(0,5000)};
        if(data.date&&!/^\\d{4}-\\d{2}-\\d{2}$/.test(data.date))throw Error('Enter a valid date');
        await db().begin(async tx=>{
            if(recordId) {
                const [row]=await tx `update business_records set data=${tx.json(data)} where id=${recordId} and company_id=${c.id} and module_id=${moduleId} returning id`;
                if(!row)throw Error('Record not found');
            } else await tx `insert into business_records(company_id,module_id,data,created_by) values(${c.id},${moduleId},${tx.json(data)},${u.id})`;
        });
        revalidatePath('/','layout');
    } catch(error) { rethrowActionError(error); }
}
export async function deleteBusinessRecord(f) {
    try {
        const slug=text(f,'slug',70), moduleId=text(f,'module',100), {u,c}=await workspace(slug,moduleId,true);
        await limitWrite(u.id,c.id,'business-record');
        await db() `delete from business_records where id=${id(f,'record')} and company_id=${c.id} and module_id=${moduleId}`;
        revalidatePath('/','layout');
    } catch(error) { rethrowActionError(error); }
}
