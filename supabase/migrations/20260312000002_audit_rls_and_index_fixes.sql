-- ============================================================
-- Migration: Audit RLS & Index Fixes
-- Date: 2026-03-12
-- Branch: fix/skill-audit-sweep
-- Fixes:
--   C1 — ingredient_price_history: broken RLS JOIN on non-existent venue_id
--   H1 — admin_data_jobs / admin_data_audit: USING(true) → org admin only
--   H3 — ingredient_price_history: add explicit DELETE=false (append-only)
--   M1 — Add missing indexes on qualification_types + staff_qualifications
-- ============================================================


-- ──────────────────────────────────────────────────────────────────────────────
-- C1 / H3: ingredient_price_history — fix broken RLS policies
-- Root cause: policies joined via ingredients.venue_id which does not exist;
--             ingredients table has org_id (not venue_id).
--             This caused ALL authenticated users to see zero price history rows.
-- ──────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view price history for their org ingredients" ON ingredient_price_history;
DROP POLICY IF EXISTS "Users can insert price history for their org ingredients" ON ingredient_price_history;

CREATE POLICY "ingredient_price_history_select"
  ON ingredient_price_history FOR SELECT
  USING (
    ingredient_id IN (
      SELECT id FROM ingredients
      WHERE org_id IN (SELECT get_user_org_ids())
    )
  );

CREATE POLICY "ingredient_price_history_insert"
  ON ingredient_price_history FOR INSERT
  WITH CHECK (
    ingredient_id IN (
      SELECT id FROM ingredients
      WHERE org_id IN (SELECT get_user_org_ids())
    )
  );

-- Explicit append-only: no UPDATE or DELETE allowed by any authenticated user
CREATE POLICY "ingredient_price_history_no_delete"
  ON ingredient_price_history FOR DELETE
  USING (false);


-- ──────────────────────────────────────────────────────────────────────────────
-- H1: admin_data_jobs and admin_data_audit — restrict to org admins
-- Root cause: created with USING(true) / WITH CHECK(true) — "no auth yet"
--             Any authenticated user could read/write system audit data.
-- ──────────────────────────────────────────────────────────────────────────────

-- admin_data_jobs
DROP POLICY IF EXISTS "Allow all operations on admin_data_jobs" ON admin_data_jobs;
DROP POLICY IF EXISTS "Authenticated access" ON admin_data_jobs;

CREATE POLICY "admin_data_jobs_org_admin_only"
  ON admin_data_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'manager')
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'manager')
        AND is_active = true
    )
  );

-- admin_data_audit
DROP POLICY IF EXISTS "Allow all operations on admin_data_audit" ON admin_data_audit;
DROP POLICY IF EXISTS "Authenticated access" ON admin_data_audit;

CREATE POLICY "admin_data_audit_org_admin_only"
  ON admin_data_audit FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'manager')
        AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE user_id = (SELECT auth.uid())
        AND role IN ('owner', 'manager')
        AND is_active = true
    )
  );


-- ──────────────────────────────────────────────────────────────────────────────
-- M1: Missing indexes on qualification tables
-- ──────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_qualification_types_org
  ON qualification_types (org_id);

CREATE INDEX IF NOT EXISTS idx_staff_qualifications_org
  ON staff_qualifications (org_id);

CREATE INDEX IF NOT EXISTS idx_staff_qualifications_staff
  ON staff_qualifications (staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_qualifications_expiry
  ON staff_qualifications (expiry_date)
  WHERE expiry_date IS NOT NULL;
