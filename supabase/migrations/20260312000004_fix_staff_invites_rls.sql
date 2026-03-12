-- ============================================================
-- Migration: Fix staff_invites RLS — restrict to org members
-- Date: 2026-03-12
-- Audit ref: H2 (database-audit.md)
-- Issue: "Anyone can read invite by token" policy used USING(true),
--        allowing any authenticated user to enumerate all invites
--        across all organisations (email addresses, tokens, expiry).
-- Fix:
--   1. Drop the USING(true) SELECT policy.
--   2. The existing "Users can view invites for their org" policy
--      already restricts SELECT to authenticated org members — no
--      new SELECT policy required.
--   3. Tighten INSERT / UPDATE / DELETE to org admins (owner/manager)
--      only — staff members have no reason to manage invites.
--
-- NOTE: InvitePortal.tsx previously did a client-side token lookup
-- for unauthenticated users via this permissive policy.  That lookup
-- will now fail for unauthenticated callers.  A server-side
-- /api/invites/verify endpoint using service_role should be built
-- to replace it (see AUDIT_SUMMARY.md P0 backlog item).
-- ============================================================


-- ── 1. Remove the permissive "anyone" SELECT policy ──────────────────────────
DROP POLICY IF EXISTS "Anyone can read invite by token" ON staff_invites;


-- ── 2. Tighten INSERT to org admins only ─────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert invites for their org" ON staff_invites;

CREATE POLICY "staff_invites_admin_insert"
  ON staff_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = (SELECT auth.uid())
        AND org_members.org_id  = staff_invites.org_id
        AND org_members.role   IN ('owner', 'manager')
        AND org_members.is_active = true
    )
  );


-- ── 3. Tighten UPDATE to org admins only ─────────────────────────────────────
DROP POLICY IF EXISTS "Users can update invites for their org" ON staff_invites;

CREATE POLICY "staff_invites_admin_update"
  ON staff_invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = (SELECT auth.uid())
        AND org_members.org_id  = staff_invites.org_id
        AND org_members.role   IN ('owner', 'manager')
        AND org_members.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = (SELECT auth.uid())
        AND org_members.org_id  = staff_invites.org_id
        AND org_members.role   IN ('owner', 'manager')
        AND org_members.is_active = true
    )
  );


-- ── 4. Tighten DELETE to org admins only ─────────────────────────────────────
DROP POLICY IF EXISTS "Users can delete invites for their org" ON staff_invites;

CREATE POLICY "staff_invites_admin_delete"
  ON staff_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.user_id = (SELECT auth.uid())
        AND org_members.org_id  = staff_invites.org_id
        AND org_members.role   IN ('owner', 'manager')
        AND org_members.is_active = true
    )
  );
