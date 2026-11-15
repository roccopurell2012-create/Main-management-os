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
import { rateLimit, loginRateLimit, limitWrite } from '../lib/rate-limit.mjs';
import { upload } from '../lib/uploads.mjs';
const text = (f, k, max = 500) => z.string().trim().min(1).max(max).parse(f.get(k));
const id = (f, k) => z.uuid().parse(f.get(k));
async function audit(tx, u, c, action) { await tx `insert into audit_events(actor_id,company_id,action) values(${u.id},${c},${action})`; }
const POLICY_VERSIONS = { terms: 'terms-draft-2026-11-15', privacy: 'privacy-2026-11-15', cookies: 'cookies-2026-11-15' };
export async function login(f) {
    let loginStage = 'validate-input', loginPath = '/login';
    try {
        const email = z.email().max(254).parse(text(f, 'email', 254)).toLowerCase(), password = passwordInput(f.get('password'));
        const companySlug = f.get('companySlug') ? z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(70).parse(f.get('companySlug')) : null;
        loginPath = companySlug ? '/c/' + companySlug + '/login' : '/login';
        if (f.get('policyConsent') !== 'on') redirect(loginPath + '?error=consent');
        loginStage = 'rate-limit';
        const source = process.env.VERCEL === '1' ? (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() : 'local';
        if (!await loginRateLimit(email, source || 'unknown'))
            redirect(loginPath + '?error=rate');
        loginStage = 'account-and-membership-lookup';
        const sql = db();
        const [u] = await sql `select u.*,
          (not ${Boolean(companySlug)} or exists(
            select 1 from companies c where c.slug=${companySlug ?? ''} and c.status='active'
              and (u.platform_admin or exists(select 1 from memberships m where m.company_id=c.id and m.user_id=u.id))
          )) as company_login_allowed
          from users u where u.email=${email} and not u.disabled`;
        loginStage = 'password-check';
        const valid = await verifyPassword(password, u?.password_hash ?? DUMMY_HASH);
        if (!u || !valid || !u.company_login_allowed)
            redirect(loginPath + '?error=invalid');
        if (!u.password_hash.startsWith('scrypt-v2:'))
            await sql `update users set password_hash=${await passwordHash(password)} where id=${u.id}`;
        loginStage = 'session-write';
        const rememberMe = f.get('rememberMe') === 'on';
        const sessionSeconds = rememberMe ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
        const token = randomBytes(32).toString('hex');
        await sql.begin(async tx => {
            await tx `insert into policy_acceptances(user_id,terms_version,privacy_version,cookie_version,accepted_at)
              values(${u.id},${POLICY_VERSIONS.terms},${POLICY_VERSIONS.privacy},${POLICY_VERSIONS.cookies},now())
              on conflict(user_id,terms_version,privacy_version,cookie_version) do update set accepted_at=now()`;
            await tx `insert into sessions(token_hash,user_id,expires_at) values(${tokenHash(token)},${u.id},now()+(${sessionSeconds} * interval '1 second'))`;
        });
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
        const logo = await upload(f.get('logo'), true), loginImage = await upload(f.get('loginImage'), true);
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
                const [previous] = await tx `select logo_id from companies where id=${c.id} for update`;
                const [file] = await tx `insert into files(company_id,name,mime,data) values(${c.id},${logo.name},${logo.mime},${logo.data}) returning id`;
                await tx `update companies set logo_id=${file.id} where id=${c.id}`;
                if (previous?.logo_id) await tx `delete from files where id=${previous.logo_id} and company_id=${c.id} and message_id is null`;
            }
            if (loginImage) {
                const [previous] = await tx `select login_image_id from companies where id=${c.id} for update`;
                const [file] = await tx `insert into files(company_id,name,mime,data) values(${c.id},${loginImage.name},${loginImage.mime},${loginImage.data}) returning id`;
                await tx `update companies set login_image_id=${file.id} where id=${c.id}`;
                if (previous?.login_image_id) await tx `delete from files where id=${previous.login_image_id} and company_id=${c.id} and message_id is null`;
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
            passwordInput(password, 8);
        await limitWrite(u.id, company, 'membership');
        await db().begin(async (tx) => {
            let [member] = await tx `select id from users where email=${email}`;
            if (member && !u.platform_admin) {
                const [enrolled] = await tx `select user_id from memberships where company_id=${company} and user_id=${member.id}`;
                if (!enrolled)
                    throw Error('Ask the platform administrator to enroll an existing account');
            }
            if (!member) {
                if (password.length < 8)
                    throw Error('New accounts require a password of at least 8 characters');
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
export async function publishAnnouncement(f) {
    try {
        const u = await admin();
        await limitWrite(u.id, 'platform', 'announcement');
        const title = text(f, 'title', 120), body = text(f, 'body', 3000);
        const target = String(f.get('company') || 'all');
        const targetCompanyId = target === 'all' ? null : id(f, 'company');
        let recipients = 0;
        await db().begin(async tx => {
            const companies = targetCompanyId
              ? await tx `select c.id from companies c join modules n on n.company_id=c.id and n.module_id='notifications' and n.enabled where c.id=${targetCompanyId} and c.status='active'`
              : await tx `select c.id from companies c join modules n on n.company_id=c.id and n.module_id='notifications' and n.enabled where c.status='active' order by c.name`;
            if (!companies.length) throw Error('No active company with notifications enabled was selected.');
            for (const company of companies) {
                const inserted = await tx `insert into notifications(company_id,user_id,title,body)
                  select ${company.id},m.user_id,${title},${body}
                  from memberships m join users recipient on recipient.id=m.user_id and not recipient.disabled
                  join modules n on n.company_id=m.company_id and n.module_id='notifications' and n.enabled and m.role=any(n.allowed_roles)
                  where m.company_id=${company.id}
                  returning id`;
                recipients += inserted.length;
                await audit(tx, u, company.id, 'Announcement published: ' + title);
            }
            if (!recipients) throw Error('There are no active company users allowed to receive notifications.');
        });
        revalidatePath('/', 'layout');
        redirect('/admin/announcements?sent=1');
    } catch (error) { rethrowActionError(error); }
}
export async function saveCompanySettings(f) {
    try {
        const slug = text(f, 'slug', 70), {u,c} = await workspace(slug, 'company-settings', true, true);
        await limitWrite(u.id, c.id, 'company-settings');
        const email = String(f.get('officeEmail') ?? '').trim().toLowerCase().slice(0,254);
        if (email) z.email().parse(email);
        const settings = {
            ...(c.settings && typeof c.settings === 'object' ? c.settings : {}),
            officeEmail: email,
            officePhone: String(f.get('officePhone') ?? '').trim().slice(0,40),
            officeAddress: String(f.get('officeAddress') ?? '').trim().slice(0,250),
            currency: z.enum(['ZAR','USD','EUR','GBP']).parse(f.get('currency')),
            dateFormat: z.enum(['DD/MM/YYYY','YYYY-MM-DD']).parse(f.get('dateFormat')),
            workWeek: z.enum(['Monday to Friday','Monday to Saturday','Monday to Sunday']).parse(f.get('workWeek')),
            defaultRecordStatus: z.enum(statuses).parse(f.get('defaultRecordStatus')),
            referencePrefix: String(f.get('referencePrefix') ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,12)
        };
        const timezone = text(f, 'timezone', 100);
        new Intl.DateTimeFormat('en', { timeZone: timezone });
        await db().begin(async tx => {
            await tx `update companies set settings=${tx.json(settings)},timezone=${timezone} where id=${c.id}`;
            await audit(tx, u, c.id, 'Company workspace settings updated');
        });
        revalidatePath('/', 'layout');
    } catch (error) { rethrowActionError(error); }
}
export async function saveSpreadsheetLink(f) {
    try {
        const u = await admin();
        const company = id(f, 'company');
        const category = text(f, 'category', 80);
        const title = text(f, 'title', 160);
        const rawUrl = z.string().url().max(2048).parse(String(f.get('url') ?? '').trim());
        const parsedUrl = new URL(rawUrl);
        if (parsedUrl.protocol !== 'https:') throw Error('Spreadsheet links must use HTTPS.');
        const entry = { id: randomBytes(10).toString('hex'), category, title, url: parsedUrl.toString() };
        await limitWrite(u.id, company, 'spreadsheet-link');
        await db().begin(async tx => {
            const [c] = await tx`select settings from companies where id=${company} for update`;
            if (!c) throw Error('Company not found');
            const settings = c.settings && typeof c.settings === 'object' ? c.settings : {};
            const links = Array.isArray(settings.spreadsheetLinks) ? settings.spreadsheetLinks : [];
            if (links.length >= 100) throw Error('This company has reached the 100 spreadsheet link limit.');
            if (links.some(link => link.url === entry.url)) throw Error('That spreadsheet link has already been added.');
            await tx`update companies set settings=${tx.json({...settings, spreadsheetLinks:[...links, entry]})} where id=${company}`;
            await audit(tx, u, company, 'Spreadsheet link added: ' + category + ' / ' + title);
        });
        revalidatePath('/', 'layout');
        redirect('/admin/company/' + company + '?sheets=1');
    } catch (error) { rethrowActionError(error); }
}

export async function deleteSpreadsheetLink(f) {
    try {
        const u = await admin();
        const company = id(f, 'company');
        const linkId = z.string().regex(/^[a-f0-9]{20}$/).parse(f.get('link'));
        await limitWrite(u.id, company, 'spreadsheet-link-delete');
        await db().begin(async tx => {
            const [c] = await tx`select settings from companies where id=${company} for update`;
            if (!c) throw Error('Company not found');
            const settings = c.settings && typeof c.settings === 'object' ? c.settings : {};
            const links = Array.isArray(settings.spreadsheetLinks) ? settings.spreadsheetLinks : [];
            const remaining = links.filter(link => link.id !== linkId);
            if (remaining.length === links.length) throw Error('Spreadsheet link not found');
            await tx`update companies set settings=${tx.json({...settings, spreadsheetLinks:remaining})} where id=${company}`;
            await audit(tx, u, company, 'Spreadsheet link removed');
        });
        revalidatePath('/', 'layout');
        redirect('/admin/company/' + company + '?sheets=1');
    } catch (error) { rethrowActionError(error); }
}

export async function changePassword(f) {
    try {
        const u = await requireUser(), current = passwordInput(f.get('current')), next = z.string().min(8).max(256).parse(f.get('next'));
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
        const recordId=f.get('record')?id(f,'record'):null, title=text(f,'title',180), settings=c.settings??{};
        let reference=String(f.get('reference')??'').trim().slice(0,100);
        if(!reference&&settings.referencePrefix) reference=settings.referencePrefix+'-'+randomBytes(3).toString('hex').toUpperCase();
        else if(reference&&settings.referencePrefix&&!reference.startsWith(settings.referencePrefix+'-')) reference=settings.referencePrefix+'-'+reference;
        const status=String(f.get('status')??settings.defaultRecordStatus??'Open').trim().slice(0,60)||'Open';
        const data={title,reference,contact:String(f.get('contact')??'').trim().slice(0,160),status,date:String(f.get('date')??'').slice(0,10),amount:String(f.get('amount')??'').trim().slice(0,30),description:String(f.get('description')??'').trim().slice(0,5000)};
        if(data.date&&!/^\d{4}-\d{2}-\d{2}$/.test(data.date))throw Error('Enter a valid date');
        const file=await upload(f.get('attachment'));
        let savedId=recordId;
        await db().begin(async tx=>{
            if(recordId) {
                const [row]=await tx `update business_records set data=${tx.json(data)} where id=${recordId} and company_id=${c.id} and module_id=${moduleId} returning id`;
                if(!row)throw Error('Record not found');
            } else {
                const [row]=await tx `insert into business_records(company_id,module_id,data,created_by) values(${c.id},${moduleId},${tx.json(data)},${u.id}) returning id`;
                savedId=row.id;
            }
            if(file){
                const [count]=await tx `select count(*)::int n from files where business_record_id=${savedId} and company_id=${c.id}`;
                if(count.n>=5)throw Error('A record can have up to five attachments.');
                await tx `insert into files(company_id,business_record_id,name,mime,data) values(${c.id},${savedId},${file.name},${file.mime},${file.data})`;
            }
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
export async function saveProfile(f) {
    try {
        const u = await requireUser(), name = text(f, 'name', 120), darkMode = f.get('darkMode') === 'on';
        await limitWrite(u.id, 'profile', 'profile');
        await db().begin(async tx => {
            await tx `update users set name=${name},dark_mode=${darkMode} where id=${u.id}`;
            await audit(tx, u, null, 'Account profile updated');
        });
        revalidatePath('/', 'layout');
    } catch (error) { rethrowActionError(error); }
}
export async function requestPasswordReset(f) {
    try {
        const email = z.email().max(254).parse(text(f, 'email', 254)).toLowerCase();
        const rawCompanySlug = String(f.get('companySlug') ?? '');
        const requestedCompany = rawCompanySlug ? z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(70).parse(rawCompanySlug) : null;
        if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
            redirect('/forgot-password?unavailable=1' + (requestedCompany ? '&company=' + requestedCompany : ''));
        const source = process.env.VERCEL === '1' ? (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() : 'local';
        if (!await rateLimit('password-reset-email', email, 4, 900) || !await rateLimit('password-reset-source', source || 'unknown', 20, 900))
            redirect('/forgot-password?sent=1');
        const [account] = await db() `select u.id,u.email,
          exists(select 1 from memberships m join companies c on c.id=m.company_id where m.user_id=u.id and c.slug=${requestedCompany ?? ''} and c.status='active') as company_member
          from users u where u.email=${email} and not u.disabled`;
        if (!account)
            redirect('/forgot-password?sent=1');
        const companySlug = requestedCompany && account.company_member ? requestedCompany : null;
        const token = randomBytes(32).toString('hex'), hashed = tokenHash(token);
        await db().begin(async tx => {
            await tx `delete from password_reset_tokens where user_id=${account.id}`;
            await tx `insert into password_reset_tokens(token_hash,user_id,company_slug,expires_at) values(${hashed},${account.id},${companySlug},now()+interval '30 minutes')`;
        });
        const baseUrl = (process.env.APP_BASE_URL || 'https://rocco-creations-portal.vercel.app').replace(/\/+$/, '');
        const resetUrl = baseUrl + '/reset-password?token=' + token;
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'password-reset/' + hashed },
            body: JSON.stringify({
                from: process.env.RESEND_FROM_EMAIL,
                to: [account.email],
                subject: 'Reset your Rocco Creations workspace password',
                html: '<p>We received a request to reset your workspace password.</p><p><a href="' + resetUrl + '">Choose a new password</a></p><p>This link expires in 30 minutes and can only be used once. If you did not request this, ignore this message.</p>',
                text: 'We received a request to reset your workspace password. Open this one-time link within 30 minutes: ' + resetUrl + '. If you did not request this, ignore this message.'
            }),
            signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) {
            console.error('password-reset-email-failed', { status: response.status });
            redirect('/forgot-password?unavailable=1' + (requestedCompany ? '&company=' + requestedCompany : ''));
        }
        redirect('/forgot-password?sent=1');
    } catch (error) { rethrowActionError(error); }
}
export async function resetPassword(f) {
    try {
        const token = z.string().regex(/^[a-f0-9]{64}$/).parse(f.get('token'));
        const password = passwordInput(f.get('password'), 8), confirm = passwordInput(f.get('confirmPassword'), 8);
        if (password !== confirm) throw new Error('Passwords do not match.');
        const hash = await passwordHash(password), hashed = tokenHash(token);
        let companySlug = null;
        await db().begin(async tx => {
            const [reset] = await tx `delete from password_reset_tokens where token_hash=${hashed} and expires_at>now() returning user_id,company_slug`;
            if (!reset) throw new Error('This password link has expired or was already used.');
            await tx `update users set password_hash=${hash} where id=${reset.user_id}`;
            await tx `delete from sessions where user_id=${reset.user_id}`;
            await tx `delete from password_reset_tokens where user_id=${reset.user_id}`;
            companySlug = reset.company_slug;
        });
        (await cookies()).delete('portal_session');
        revalidatePath('/', 'layout');
        redirect(companySlug ? '/c/' + companySlug + '/login?changed=1' : '/login?changed=1');
    } catch (error) { rethrowActionError(error); }
}
