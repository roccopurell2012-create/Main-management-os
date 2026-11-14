import { readFile, readdir } from 'node:fs/promises';
import { db } from '../lib/db.mjs';
const sql = db();
try {
    await sql.begin(async (tx) => {
        await tx `select pg_advisory_xact_lock(62471835)`;
        await tx `create table if not exists schema_migrations(name text primary key, applied_at timestamptz not null default now())`;
        const applied = await tx `select name from schema_migrations`;
        for (const name of (await readdir(new URL('../migrations/', import.meta.url))).filter(n => /^\d+_[a-z_]+\.sql$/.test(n)).sort()) {
            if (applied.some(row => row.name === name))
                continue;
            await tx.unsafe(await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8'));
            await tx `insert into schema_migrations(name) values(${name})`;
        }
    });
    console.log('Migrations applied.');
}
catch {
    console.error('Migration failed. Inspect database permissions and migration state privately.');
    process.exitCode = 1;
}
finally {
    await sql.end();
}
