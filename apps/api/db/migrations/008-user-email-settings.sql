-- Lead2 v3.5: User email settings and lead email drafts. Apply with --single-transaction.

-- Store user-level outbound email settings (sender identity & custom SMTP)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Lead email drafts per user
CREATE TABLE IF NOT EXISTS lead_email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, lead_id, user_id)
);
CREATE INDEX IF NOT EXISTS lead_email_drafts_idx ON lead_email_drafts(tenant_id, lead_id, user_id);

-- Enable RLS on lead_email_drafts
DO $$ BEGIN
  EXECUTE 'ALTER TABLE lead_email_drafts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON lead_email_drafts';
  EXECUTE 'CREATE POLICY tenant_isolation ON lead_email_drafts USING (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid)';
END $$;

GRANT SELECT,INSERT,UPDATE,DELETE ON lead_email_drafts TO crm_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;
