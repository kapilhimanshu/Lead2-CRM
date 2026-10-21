-- Lead2 v3.6: Billing, subscriptions, encrypted payment tokens, and high-scale composite indexes.

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'standard',
  seats int NOT NULL DEFAULT 5,
  billing_cycle text NOT NULL DEFAULT 'annual', -- 'annual' or 'monthly'
  currency text NOT NULL DEFAULT 'INR',
  unit_price numeric(10,2) NOT NULL DEFAULT 149,
  total_amount numeric(12,2) NOT NULL DEFAULT 8940,
  status text NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'canceled'
  current_period_end timestamptz NOT NULL DEFAULT now() + interval '1 year',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

CREATE TABLE IF NOT EXISTS billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  billing_cycle text NOT NULL DEFAULT 'annual',
  seats int NOT NULL DEFAULT 5,
  payment_method text NOT NULL DEFAULT 'card', -- 'card', 'upi', 'wallet'
  reference text NOT NULL,
  status text NOT NULL DEFAULT 'completed', -- 'completed', 'pending', 'failed'
  notes text,
  encrypted_vault_token text,
  integrity_signature text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- High-load composite & partial indexes across tenant workloads
CREATE INDEX IF NOT EXISTS billing_tx_tenant_idx ON billing_transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_unallocated_fast_idx ON leads(tenant_id, created_at DESC) WHERE owner_id IS NULL;
CREATE INDEX IF NOT EXISTS leads_tenant_stage_created_idx ON leads(tenant_id, stage_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_tenant_owner_idx ON leads(tenant_id, owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_tenant_status_due_idx ON tasks(tenant_id, status, due_at);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_created_idx ON audit_logs(tenant_id, created_at DESC);

-- Enable RLS on both billing tables (with transaction-scoped platform_admin read/write support)
DO $$ BEGIN
  EXECUTE 'ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON tenant_subscriptions';
  EXECUTE 'CREATE POLICY tenant_isolation ON tenant_subscriptions USING (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid OR current_setting(''app.platform_admin'', true) = ''1'') WITH CHECK (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid OR current_setting(''app.platform_admin'', true) = ''1'')';

  EXECUTE 'ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON billing_transactions';
  EXECUTE 'CREATE POLICY tenant_isolation ON billing_transactions USING (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid OR current_setting(''app.platform_admin'', true) = ''1'') WITH CHECK (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid OR current_setting(''app.platform_admin'', true) = ''1'')';
END $$;

GRANT SELECT,INSERT,UPDATE,DELETE ON tenant_subscriptions TO crm_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON billing_transactions TO crm_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;
