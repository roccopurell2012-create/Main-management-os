import { securityHeaders } from './lib/security-headers.mjs';
export default {
    poweredByHeader: false,
    images: { unoptimized: true },
    productionBrowserSourceMaps: false,
    experimental: { serverActions: { bodySizeLimit: '4mb' } },
    async headers() {
        return [{ source: '/:path*', headers: [...securityHeaders,
                    ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : [])] }];
    },
};
