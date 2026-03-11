-- ============================================================
-- Xero Accounting Integration
-- Tables: xero_connections, xero_sync_log, xero_account_mappings
-- All scoped to org_id, full RLS policies
-- ============================================================

-- ── xero_connections ─────────────────────────────────────────
-- Stores OAuth tokens (encrypted), tenant/organisation info,
-- and connection status per SuperSolt org.
CREATE TABLE IF NOT EXISTS xero_connections (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Xero OAuth tokens (AES-256-GCM encrypted, same scheme as pos_connections)
  access_token      TEXT,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,

  -- Xero organisation/tenant
  tenant_id         TEXT,           -- Xero tenant/organisation ID
  tenant_name       TEXT,           -- Display name of the connected Xero org
  tenant_type       TEXT,           -- 'ORGANISATION' | 'PRACTICE'

  -- Sync settings
  last_sync_at      TIMESTAMPTZ,
  last_sync_status  TEXT,           -- 'success' | 'error: <message>'

  -- Status
  is_active         BOOLEAN     NOT NULL DEFAULT true,

  -- Audit
  connected_by      UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One Xero connection per org
ALTER TABLE xero_connections
  ADD CONSTRAINT xero_connections_org_id_unique UNIQUE (org_id);

-- RLS
ALTER TABLE xero_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view xero connection"
  ON xero_connections FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org admins can insert xero connection"
  ON xero_connections FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "org admins can update xero connection"
  ON xero_connections FOR UPDATE
  USING (is_org_admin(org_id));

CREATE POLICY "org admins can delete xero connection"
  ON xero_connections FOR DELETE
  USING (is_org_admin(org_id));

-- ── xero_sync_log ─────────────────────────────────────────────
-- Records every sync attempt — direction, record counts, errors.
CREATE TABLE IF NOT EXISTS xero_sync_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  xero_connection_id UUID     REFERENCES xero_connections(id) ON DELETE SET NULL,

  -- What synced
  direction       TEXT        NOT NULL CHECK (direction IN ('push', 'pull', 'both')),
  sync_type       TEXT        NOT NULL,  -- 'sales', 'purchases', 'payroll', 'accounts'

  -- Results
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'success', 'partial', 'error')),
  records_pushed  INTEGER     DEFAULT 0,
  records_pulled  INTEGER     DEFAULT 0,
  error_message   TEXT,

  -- Timing
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE xero_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view xero sync log"
  ON xero_sync_log FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org admins can insert xero sync log"
  ON xero_sync_log FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org admins can update xero sync log"
  ON xero_sync_log FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()));

-- ── xero_account_mappings ─────────────────────────────────────
-- Maps SuperSolt financial categories to Xero chart of accounts.
-- Populated by the admin in Settings > Integrations > Xero Mapping.
CREATE TABLE IF NOT EXISTS xero_account_mappings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- SuperSolt category (standard AU hospitality categories)
  supersolt_category  TEXT    NOT NULL,
  -- e.g. 'revenue_food', 'revenue_beverage', 'cogs_food', 'cogs_beverage',
  --      'labour_wages', 'labour_super', 'gst_collected', 'gst_paid',
  --      'overhead_rent', 'overhead_utilities', 'overhead_marketing'

  -- Xero account details (from chart of accounts)
  xero_account_code   TEXT,    -- e.g. '200', '310'
  xero_account_id     TEXT,    -- Xero AccountID UUID
  xero_account_name   TEXT,    -- Display name for UI

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One mapping per category per org
ALTER TABLE xero_account_mappings
  ADD CONSTRAINT xero_account_mappings_org_category_unique
  UNIQUE (org_id, supersolt_category);

-- RLS
ALTER TABLE xero_account_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can view xero account mappings"
  ON xero_account_mappings FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "org admins can insert xero account mappings"
  ON xero_account_mappings FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "org admins can update xero account mappings"
  ON xero_account_mappings FOR UPDATE
  USING (is_org_admin(org_id));

CREATE POLICY "org admins can delete xero account mappings"
  ON xero_account_mappings FOR DELETE
  USING (is_org_admin(org_id));

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_xero_connections_org_id
  ON xero_connections(org_id);

CREATE INDEX IF NOT EXISTS idx_xero_sync_log_org_id
  ON xero_sync_log(org_id);

CREATE INDEX IF NOT EXISTS idx_xero_sync_log_started_at
  ON xero_sync_log(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_xero_account_mappings_org_id
  ON xero_account_mappings(org_id);

-- ── Default AU hospitality account mapping seeds ──────────────
-- Sensible defaults based on standard Xero AU chart of accounts.
-- Orgs can override these after connecting.
-- NOTE: These are inserted as defaults on first Xero connection
-- by the API callback — not inserted here (no org_id to seed against).
-- See api/xero/callback.ts for default seed logic.
