import { db } from '../../../../lib/db.mjs';
export const runtime = 'nodejs';
export async function GET(_request, { params }) {
    const { slug } = await params;
    if (typeof slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
        return new Response(null, { status: 404 });
    const [file] = await db() `select f.mime,f.data from companies c join files f on f.id=c.login_image_id and f.company_id=c.id where c.slug=${slug} and c.status='active'`;
    if (!file || !['image/png','image/jpeg'].includes(file.mime))
        return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(new Uint8Array(file.data), { headers: {
        'Content-Type': file.mime,
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
    }});
}
