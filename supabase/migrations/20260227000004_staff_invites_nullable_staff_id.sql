-- Make staff_id nullable on staff_invites
-- staff_id shouldn't be required when creating an invite — the person hasn't accepted yet
ALTER TABLE staff_invites ALTER COLUMN staff_id DROP NOT NULL;
ALTER TABLE staff_invites ALTER COLUMN staff_id SET DEFAULT NULL;

-- Add invited_by column if not exists
ALTER TABLE staff_invites ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id);
