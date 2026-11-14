import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { csp } from './lib/security-headers.mjs';
export function proxy(request) {
    const policy = csp(randomBytes(18).toString('base64'), process.env.NODE_ENV === 'production');
    const headers = new Headers(request.headers);
    // Replace any client-supplied CSP. Next extracts its script nonce during rendering.
    headers.set('Content-Security-Policy', policy);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set('Content-Security-Policy', policy);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
}
export const config = { matcher: ['/((?!api/files|_next/static|_next/image|favicon.ico|robots.txt).*)'] };
