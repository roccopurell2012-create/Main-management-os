-- REVIEW TEMPLATE ONLY; NOT EXECUTED. Dedicated portal database required.
-- DBA/provider must create and authenticate portal_runtime separately, with
-- NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT and no table/schema ownership.
-- Replace role name only if your provider requires it. No credential literals.
GRANT USAGE ON SCHEMA public TO portal_runtime;
GRANT SELECT, INSERT, UPDATE ON users, companies, modules, tickets, messages, files TO portal_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON memberships, sessions, rate_limits TO portal_runtime;
GRANT SELECT, INSERT, UPDATE ON notifications TO portal_runtime;
GRANT SELECT, INSERT ON audit_events TO portal_runtime;
-- Maintenance uses a separate trusted role: it needs DELETE on sessions,
-- rate_limits, login_attempts only; runtime need not delete legacy email rows.
-- No grants on schema_migrations or business_records until a reviewed use exists.
-- Review ambient PUBLIC/database/schema privileges separately with the DBA;
-- do not blindly revoke privileges on a database containing unrelated services.
