-- Fix 1: Add DELETE policy for staff_invites (removeInvite was silently failing)
CREATE POLICY "Users can delete invites for their org" ON staff_invites
  FOR DELETE USING (
    org_id IN (
      SELECT om.org_id FROM org_members om
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
  );

-- Fix 2: Add role column to staff_invites (staff_id was being misused to store role)
ALTER TABLE staff_invites ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'staff';
