import postgres from 'postgres';
let client;
export function db() {
    if (!process.env.DATABASE_URL)
        throw new Error('Database setup is required.');
    const production = process.env.NODE_ENV === 'production';
    const ca = process.env.SUPABASE_CA_CERT?.trim();
    if (production && (!ca?.startsWith('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')))
        throw new Error('Verified Supabase CA certificate is required in production.');
    return client ??= postgres(process.env.DATABASE_URL, {
        ...(production ? { ssl: { ca, rejectUnauthorized: true } } : {}),
        max: 5,
        prepare: false,
        connect_timeout: 10,
        idle_timeout: 20,
        query_timeout: 30
    });
}
