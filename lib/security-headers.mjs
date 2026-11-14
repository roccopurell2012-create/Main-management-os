export function csp(nonce, production = true) {
    if (!/^[A-Za-z0-9+/=_-]+$/.test(nonce))
        throw new Error('Invalid nonce');
    return ["default-src 'self'", `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${production ? '' : " 'unsafe-eval'"}`,
        // Brand colours use style attributes; script inline execution remains nonce-only.
        "style-src 'self' 'unsafe-inline'", "img-src 'self'", "font-src 'self'",
        `connect-src 'self'${production ? '' : ' ws: wss:'}`, "object-src 'none'", "base-uri 'none'",
        "form-action 'self'", "frame-ancestors 'none'", ...(production ? ['upgrade-insecure-requests'] : [])].join('; ');
}
export const securityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'same-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];
