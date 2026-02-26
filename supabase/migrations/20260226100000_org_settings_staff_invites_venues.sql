-- Bug 1: Add settings JSONB column to organizations for extended org settings
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

-- Bug 2: Create staff_invites table for persisting onboarding invites
CREATE TABLE IF NOT EXISTS staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id text NOT NULL,
  token text NOT NULL UNIQUE,
  sent_to_email text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accessed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_org_id ON staff_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON staff_invites(token);

-- RLS for staff_invites (org_id scoped)
ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invites for their org" ON staff_invites
  FOR SELECT USING (
    org_id IN (
      SELECT om.org_id FROM org_members om
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
  );

CREATE POLICY "Users can insert invites for their org" ON staff_invites
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM org_members om
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
  );

CREATE POLICY "Users can update invites for their org" ON staff_invites
  FOR UPDATE USING (
    org_id IN (
      SELECT om.org_id FROM org_members om
      WHERE om.user_id = auth.uid() AND om.is_active = true
    )
  );

-- Public access for invite portal (token-based lookup without auth)
CREATE POLICY "Anyone can read invite by token" ON staff_invites
  FOR SELECT USING (true);

-- Bug 3: Add address, timezone, trading_hours to venues table
ALTER TABLE venues ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Australia/Melbourne';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS trading_hours jsonb DEFAULT '{}'::jsonb;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS venue_type text DEFAULT 'restaurant';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS created_by uuid;
