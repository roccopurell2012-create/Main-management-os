import { db } from './db.mjs';
import { tokenHash } from './password.mjs';
// Database-backed fixed windows survive serverless instance churn. No raw emails/IPs.
export async function rateLimit(scope, identity, maximum, seconds) {
    const key = tokenHash(`rate:${scope}:${identity}`);
    const rows = await db() `insert into rate_limits(key, hits, expires_at)
    values(${key}, 1, now() + ${seconds} * interval '1 second')
    on conflict(key) do update set
      hits = case when rate_limits.expires_at <= now() then 1 else rate_limits.hits + 1 end,
      expires_at = case when rate_limits.expires_at <= now() then excluded.expires_at else rate_limits.expires_at end
    where rate_limits.expires_at <= now() or rate_limits.hits < ${maximum}
    returning key`;
    return rows.length > 0;
}
export async function limitWrite(userId, companyId, scope = 'write') {
    if (!await rateLimit(scope, userId, 30, 60) || !await rateLimit('company-write', companyId, 200, 60))
        throw new Error('Too many requests. Please wait a minute before trying again.');
}
