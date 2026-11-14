-- Additive review migration: no customer records are deleted or rewritten.
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL CHECK (hits > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires_at);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS memberships_user ON memberships(user_id, company_id);
CREATE INDEX IF NOT EXISTS files_message ON files(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS audit_company_date ON audit_events(company_id, created_at DESC);
