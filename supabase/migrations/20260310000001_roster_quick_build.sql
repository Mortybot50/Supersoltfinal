-- Roster Quick Build: roster_patterns table + template_shifts column on shift_templates
-- Phase 1: templates, copy, patterns, auto-fill

-- ── 1. Add template_shifts column to shift_templates ──────────────────────────
ALTER TABLE shift_templates
  ADD COLUMN IF NOT EXISTS template_shifts JSONB NOT NULL DEFAULT '[]';

-- ── 2. roster_patterns table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roster_patterns (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id      UUID        NOT NULL REFERENCES venues(id)        ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  shifts        JSONB       NOT NULL DEFAULT '[]',
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roster_patterns_org     ON roster_patterns(org_id);
CREATE INDEX IF NOT EXISTS idx_roster_patterns_venue   ON roster_patterns(venue_id);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_roster_patterns_updated_at ON roster_patterns;
CREATE TRIGGER update_roster_patterns_updated_at
  BEFORE UPDATE ON roster_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE roster_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view roster patterns"
  ON roster_patterns FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Managers can manage roster patterns"
  ON roster_patterns FOR ALL
  USING (is_org_admin(org_id));
