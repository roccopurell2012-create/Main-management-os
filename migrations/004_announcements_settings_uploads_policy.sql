-- Add app announcements, per-company preferences, policy acknowledgements, and workspace file attachments.
ALTER TABLE notifications ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '';

ALTER TABLE companies ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';

ALTER TABLE files ADD COLUMN IF NOT EXISTS business_record_id uuid REFERENCES business_records(id) ON DELETE CASCADE;
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_data_check;
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_data_max_10mb;
ALTER TABLE files ADD CONSTRAINT files_data_max_10mb CHECK (octet_length(data) <= 10485760);
CREATE INDEX IF NOT EXISTS files_business_record ON files(business_record_id) WHERE business_record_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  cookie_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, terms_version, privacy_version, cookie_version)
);
CREATE INDEX IF NOT EXISTS policy_acceptances_user_date ON policy_acceptances(user_id, accepted_at DESC);
