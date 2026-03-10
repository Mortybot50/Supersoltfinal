-- ============================================================
-- Quick Build Sidebar: template_shifts + roster_patterns
-- ============================================================

-- Add multi-shift support to existing shift_templates
-- (each template can now represent a full week roster pattern)
ALTER TABLE shift_templates
  ADD COLUMN IF NOT EXISTS template_shifts JSONB DEFAULT '[]'::jsonb;

-- ──────────────────────────────────────────────────────────
-- Roster patterns — named recurring weekly shift patterns
-- e.g. "Mon-Wed-Fri Kitchen Open" = 3 shift defs applied each week
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roster_patterns (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  venue_id     UUID        NOT NULL REFERENCES venues(id)         ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  description  TEXT,
  shifts       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roster_patterns_venue ON roster_patterns(venue_id);
CREATE INDEX IF NOT EXISTS idx_roster_patterns_org   ON roster_patterns(org_id);

ALTER TABLE roster_patterns ENABLE ROW LEVEL SECURITY;

-- Members can view patterns for their org
CREATE POLICY "members_view_roster_patterns"
  ON roster_patterns FOR SELECT
  USING (org_id = ANY(get_user_org_ids()));

-- Admins can create/update/delete patterns
CREATE POLICY "admins_insert_roster_patterns"
  ON roster_patterns FOR INSERT
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "admins_update_roster_patterns"
  ON roster_patterns FOR UPDATE
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

CREATE POLICY "admins_delete_roster_patterns"
  ON roster_patterns FOR DELETE
  USING (is_org_admin(org_id));
