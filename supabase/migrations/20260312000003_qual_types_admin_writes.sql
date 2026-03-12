-- ============================================================
-- Migration: Restrict qualification_types writes to org admins
-- Date: 2026-03-12
-- Branch: fix/admin-qual-types-and-test-db
-- Fixes:
--   M2 — qualification_types INSERT/UPDATE/DELETE open to all org members;
--        restrict to role IN ('admin', 'owner') only.
-- ============================================================

DROP POLICY IF EXISTS "qual_types_insert" ON public.qualification_types;
DROP POLICY IF EXISTS "qual_types_update" ON public.qualification_types;
DROP POLICY IF EXISTS "qual_types_delete" ON public.qualification_types;

CREATE POLICY "qual_types_insert"
  ON public.qualification_types FOR INSERT
  WITH CHECK (
    org_id IN (SELECT get_user_org_ids())
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = (SELECT auth.uid())
        AND org_id = qualification_types.org_id
        AND role IN ('admin', 'owner')
        AND is_active = true
    )
  );

CREATE POLICY "qual_types_update"
  ON public.qualification_types FOR UPDATE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = (SELECT auth.uid())
        AND org_id = qualification_types.org_id
        AND role IN ('admin', 'owner')
        AND is_active = true
    )
  );

CREATE POLICY "qual_types_delete"
  ON public.qualification_types FOR DELETE
  USING (
    org_id IN (SELECT get_user_org_ids())
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE user_id = (SELECT auth.uid())
        AND org_id = qualification_types.org_id
        AND role IN ('admin', 'owner')
        AND is_active = true
    )
  );
