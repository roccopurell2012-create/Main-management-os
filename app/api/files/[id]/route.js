import {isRecordId} from '../../../record-id.js';
import { db } from '../../../../lib/db.mjs';
import { requireUser, workspace, ticketAccess } from '../../../../lib/auth.mjs';
import { rateLimit } from '../../../../lib/rate-limit.mjs';
import { notFound } from 'next/navigation';
export const runtime = 'nodejs';
export async function GET(request, { params }) {
    const u = await requireUser(), { id } = await params;
    if (!isRecordId(id))
        notFound();
    if (!await rateLimit('download', u.id, 120, 60))
        return new Response('Please try again later.', { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });
    // Fetch metadata first: unauthorized callers never cause the blob to be materialized.
    const [f] = await db() `select f.id,f.company_id,f.message_id,f.name,f.mime,c.slug,c.logo_id,m.ticket_id,m.private
    from files f join companies c on c.id=f.company_id left join messages m on m.id=f.message_id where f.id=${id}`;
    if (!f)
        notFound();
    await workspace(f.slug);
    if (f.message_id) {
        if (f.private && !u.platform_admin)
            notFound();
        await ticketAccess(f.ticket_id);
    }
    else if (f.logo_id !== f.id && !u.platform_admin)
        notFound();
    const [blob] = await db() `select data from files where id=${f.id} and company_id=${f.company_id}`;
    if (!blob)
        notFound();
    const name = f.name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'attachment';
    return new Response(new Uint8Array(blob.data), { headers: {
            'Content-Type': f.mime,
            'Content-Disposition': (f.message_id ? 'attachment' : 'inline') + '; filename="' + name + '"',
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
        } });
}
