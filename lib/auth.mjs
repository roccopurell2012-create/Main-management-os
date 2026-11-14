import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { db } from './db.mjs';
import { tokenHash } from './password.mjs';
import { canManage, canWrite, canEnableModule } from './catalog.mjs';
export async function user() { const token = (await cookies()).get('portal_session')?.value; if (!token)
    return null; const [u] = await db() `select u.* from sessions s join users u on u.id=s.user_id where s.token_hash=${tokenHash(token)} and s.expires_at>now() and not u.disabled`; return u ?? null; }
export async function requireUser() { const u = await user(); if (!u)
    redirect('/login'); return u; }
export async function admin() { const u = await requireUser(); if (!u.platform_admin)
    notFound(); return u; }
export async function workspace(slug, moduleId, write = false, manage = false) { const u = await requireUser(); const [c] = await db() `select c.*,m.role from companies c left join memberships m on m.company_id=c.id and m.user_id=${u.id} where c.slug=${slug} and (${u.platform_admin} or m.user_id is not null)`; if (!c || (!u.platform_admin && c.status !== 'active'))
    notFound(); const role = u.platform_admin ? 'owner' : c.role; if (write && !canWrite(role) || manage && !canManage(role))
    notFound(); if (moduleId) {
    if (!canEnableModule(moduleId)) notFound();
    const [m] = await db() `select * from modules where company_id=${c.id} and module_id=${moduleId} and enabled`;
    if (!m || !m.allowed_roles.includes(role))
        notFound();
} return { u, c, role }; }
export async function ticketAccess(id, write = false) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) notFound(); const u = await requireUser(); const [t] = await db() `select t.*,c.slug,c.name company_name,c.status company_status,m.role from tickets t join companies c on c.id=t.company_id left join memberships m on m.company_id=c.id and m.user_id=${u.id} where t.id=${id} and (${u.platform_admin} or m.user_id is not null)`; if (!t)
    notFound(); if (!u.platform_admin)
    await workspace(t.slug, 'support-tickets', write); return { u, t }; }
