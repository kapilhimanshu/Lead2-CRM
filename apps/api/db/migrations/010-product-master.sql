-- Lead2 v3.7: Configurable Product Types, Multi-Currency & Tiered Product Master (CPQ), and Decoupled Proposal Line Item Snapshots.

CREATE TABLE IF NOT EXISTS product_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'recurring' CHECK (category IN ('recurring', 'service_milestone', 'physical_good', 'custom')),
  billing_frequency text NOT NULL DEFAULT 'monthly' CHECK (billing_frequency IN ('monthly', 'quarterly', 'annual', 'one_time', 'hourly', 'milestone')),
  default_tax_pct numeric(6,2) NOT NULL DEFAULT 18,
  description text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS product_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_type_id uuid REFERENCES product_types(id) ON DELETE SET NULL,
  product_type_code text NOT NULL DEFAULT 'service_milestone',
  sku text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'unit',
  base_currency text NOT NULL DEFAULT 'INR',
  base_price numeric(14,2) NOT NULL DEFAULT 0,
  tax_pct numeric(6,2) NOT NULL DEFAULT 18,
  billing_behavior text NOT NULL DEFAULT 'monthly' CHECK (billing_behavior IN ('monthly', 'quarterly', 'annual', 'one_time', 'hourly', 'milestone')),
  currency_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  pricing_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, sku)
);

-- Decoupled Proposal Line Items Snapshot table: preserves historical SKU, pricing, tier, and tax even if Product Master changes or is archived later.
CREATE TABLE IF NOT EXISTS proposal_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  product_master_id uuid,
  sku text NOT NULL DEFAULT '',
  name text NOT NULL,
  description text NOT NULL,
  product_type_code text NOT NULL DEFAULT 'service_milestone',
  product_category text NOT NULL DEFAULT 'service_milestone',
  billing_behavior text NOT NULL DEFAULT 'one_time',
  unit text NOT NULL DEFAULT 'unit',
  qty numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  tier_applied text,
  currency text NOT NULL DEFAULT 'INR',
  discount_pct numeric(6,2) NOT NULL DEFAULT 0,
  tax_pct numeric(6,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_types_tenant_idx ON product_types(tenant_id, active);
CREATE INDEX IF NOT EXISTS product_master_tenant_idx ON product_master(tenant_id, active, sku);
CREATE INDEX IF NOT EXISTS product_master_type_idx ON product_master(tenant_id, product_type_id);
CREATE INDEX IF NOT EXISTS proposal_line_items_proposal_idx ON proposal_line_items(tenant_id, proposal_id);
CREATE INDEX IF NOT EXISTS proposal_line_items_category_idx ON proposal_line_items(tenant_id, product_category, billing_behavior);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['product_types', 'product_master', 'proposal_line_items'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.current_tenant_id'', true), '''')::uuid)', t);
  END LOOP;
END $$;

GRANT SELECT,INSERT,UPDATE,DELETE ON product_types, product_master, proposal_line_items TO crm_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;
