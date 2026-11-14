import postgres from 'postgres';
let client;
export function db() { if (!process.env.DATABASE_URL)
    throw new Error('Database setup is required.'); return client ??= postgres(process.env.DATABASE_URL, { ...(process.env.NODE_ENV === 'production' ? { ssl: { rejectUnauthorized: true } } : {}), max: 5, prepare: false, connect_timeout: 10, idle_timeout: 20, query_timeout: 30 }); }
