import { db } from './db.mjs';
import { tokenHash } from './password.mjs';
// Database-backed fixed windows survive serverless instance churn. No raw emails/IPs.
// Apply all three login limits in one PostgreSQL statement to reduce sign-in round trips.
export async function loginRateLimit(email, source) {
    const checks = [
        { scope: 'login-global', identity: 'all', maximum: 120, seconds: 60 },
        { scope: 'login-source', identity: source, maximum: 20, seconds: 60 },
        { scope: 'login-email', identity: email, maximum: 10, seconds: 900 }
    ].map(item => ({ ...item, key: tokenHash('rate:' + item.scope + ':' + item.identity) }));
    const [result] = await db() `with requested(key,maximum,seconds) as (
      select ${checks[0].key}::text,${checks[0].maximum}::int,${checks[0].seconds}::int
      union all select ${checks[1].key}::text,${checks[1].maximum}::int,${checks[1].seconds}::int
      union all select ${checks[2].key}::text,${checks[2].maximum}::int,${checks[2].seconds}::int
    ), changed as (
      insert into rate_limits(key,hits,expires_at)
      select key,1,now()+seconds*interval '1 second' from requested
      on conflict(key) do update set
        hits=case when rate_limits.expires_at<=now() then 1 else rate_limits.hits+1 end,
        expires_at=case when rate_limits.expires_at<=now() then excluded.expires_at else rate_limits.expires_at end
      where rate_limits.expires_at<=now() or rate_limits.hits<(select maximum from requested where requested.key=rate_limits.key)
      returning key
    ) select count(*)::int allowed from changed`;
    return result?.allowed === checks.length;
}
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
