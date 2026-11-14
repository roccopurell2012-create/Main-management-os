// Only expired operational state; never deletes company business records.
import { db } from '../lib/db.mjs';
const sql = db();
try {
    await sql.begin(async (tx) => {
        await tx `delete from sessions where expires_at < now()`;
        await tx `delete from rate_limits where expires_at < now() - interval '1 day'`;
        // Legacy login rows contain emails. Their configured throttle lifetime was 15 minutes.
        await tx `delete from login_attempts where last_attempt < now() - interval '1 day'`;
    });
    console.log('Expired authentication state removed.');
}
catch {
    console.error('Maintenance failed; inspect privately.');
    process.exitCode = 1;
}
finally {
    await sql.end();
}
