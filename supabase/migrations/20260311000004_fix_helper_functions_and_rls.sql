-- Fix: re-create helper functions that may be missing from staging,
-- and apply the remaining RLS policies that failed in earlier migrations
-- Safe to re-run (uses CREATE OR REPLACE and IF NOT EXISTS / DO blocks)

-- ── 1. Helper functions ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE user_id = auth.uid()
      AND org_id = check_org_id
      AND role IN ('owner', 'manager')
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ── 2. RLS policies that may have failed in 20260310000001 ────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roster_patterns') THEN
    -- Drop any partial policies before re-creating
    DROP POLICY IF EXISTS "Managers can manage roster patterns" ON roster_patterns;
    CREATE POLICY "Managers can manage roster patterns"
      ON roster_patterns FOR ALL
      USING (is_org_admin(org_id));
  END IF;
END$$;


-- ── 3. Ensure qualifications RLS policies are present ────────────────────────
-- (Migration 20260310000003 may have also failed if it used is_org_admin)

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'qualifications') THEN
    ALTER TABLE qualifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Org members can view qualifications" ON qualifications;
    DROP POLICY IF EXISTS "Managers can manage qualifications" ON qualifications;

    CREATE POLICY "Org members can view qualifications"
      ON qualifications FOR SELECT
      USING (org_id IN (SELECT get_user_org_ids()));

    CREATE POLICY "Managers can manage qualifications"
      ON qualifications FOR ALL
      USING (is_org_admin(org_id));
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_qualifications') THEN
    ALTER TABLE staff_qualifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Org members can view staff qualifications" ON staff_qualifications;
    DROP POLICY IF EXISTS "Managers can manage staff qualifications" ON staff_qualifications;

    CREATE POLICY "Org members can view staff qualifications"
      ON staff_qualifications FOR SELECT
      USING (org_id IN (SELECT get_user_org_ids()));

    CREATE POLICY "Managers can manage staff qualifications"
      ON staff_qualifications FOR ALL
      USING (is_org_admin(org_id));
  END IF;
END$$;
