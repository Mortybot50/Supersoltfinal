-- Create enum for member status
CREATE TYPE public.member_status AS ENUM ('active', 'invited', 'suspended', 'deactivated');

-- Create enum for invite status
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- Table: members
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  primary_email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  status member_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, primary_email)
);

-- Table: role_definitions
CREATE TABLE public.role_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  key TEXT NOT NULL,
  description TEXT,
  can_edit BOOLEAN DEFAULT true,
  approval_limits JSONB DEFAULT '{}',
  permissions JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, key)
);

-- Table: assignments
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.role_definitions(id) ON DELETE CASCADE,
  venue_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, role_id, venue_id)
);

-- Table: invites
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role_id UUID REFERENCES public.role_definitions(id),
  venue_id TEXT,
  invited_by_member_id UUID REFERENCES public.members(id),
  invite_token TEXT UNIQUE NOT NULL,
  status invite_status DEFAULT 'pending',
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: pins
CREATE TABLE public.pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  pin_last4 TEXT,
  is_active BOOLEAN DEFAULT true,
  last_rotated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: access_audit
CREATE TABLE public.access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  actor_member_id UUID REFERENCES public.members(id),
  action TEXT NOT NULL,
  target JSONB,
  before_snapshot JSONB,
  after_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now, refine later based on actual auth)
CREATE POLICY "Allow all operations on members" ON public.members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on role_definitions" ON public.role_definitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on invites" ON public.invites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on pins" ON public.pins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on access_audit" ON public.access_audit FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_members_org_email ON public.members(org_id, primary_email);
CREATE INDEX idx_members_status ON public.members(org_id, status);
CREATE INDEX idx_role_definitions_org ON public.role_definitions(org_id);
CREATE INDEX idx_assignments_member ON public.assignments(member_id, venue_id, role_id);
CREATE INDEX idx_assignments_org ON public.assignments(org_id);
CREATE INDEX idx_invites_token ON public.invites(invite_token);
CREATE INDEX idx_invites_org ON public.invites(org_id, status);
CREATE INDEX idx_pins_member ON public.pins(member_id, is_active);
CREATE INDEX idx_pins_org ON public.pins(org_id);
CREATE INDEX idx_access_audit_org ON public.access_audit(org_id, created_at DESC);

-- Triggers for updated_at
CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_role_definitions_updated_at BEFORE UPDATE ON public.role_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invites_updated_at BEFORE UPDATE ON public.invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pins_updated_at BEFORE UPDATE ON public.pins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed 4 base roles (example for org_id 'default', adjust as needed)
-- Note: In production, these should be created per org on org creation
INSERT INTO public.role_definitions (org_id, key, description, is_system, can_edit, approval_limits, permissions) VALUES
('default', 'Owner', 'Full access to all features, org settings, and member management', true, true, 
  '{"price_change_percent": 100, "po_amount": 999999, "roster_over_percent": 100}'::jsonb,
  '{"inventory": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "recipes": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "menu_items": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "purchasing": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "workforce": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "time_attendance": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "cash_flow": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "insights": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "food_safety": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "daybook": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "automation": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "admin_org": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "admin_venue": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "admin_data": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}, "admin_roles": {"read": true, "create": true, "update": true, "delete": true, "export": true, "approve": true}}'::jsonb),

('default', 'Manager', 'Manage day-to-day operations, can approve within limits', true, true,
  '{"price_change_percent": 15, "po_amount": 5000, "roster_over_percent": 10}'::jsonb,
  '{"inventory": {"read": true, "create": true, "update": true, "delete": false, "export": true, "approve": true}, "recipes": {"read": true, "create": true, "update": true, "delete": false, "export": true, "approve": false}, "menu_items": {"read": true, "create": true, "update": true, "delete": false, "export": true, "approve": false}, "purchasing": {"read": true, "create": true, "update": true, "delete": false, "export": true, "approve": true}, "workforce": {"read": true, "create": true, "update": true, "delete": false, "export": true, "approve": true}, "time_attendance": {"read": true, "create": true, "update": true, "delete": false, "export": true, "approve": true}, "insights": {"read": true, "export": true}, "food_safety": {"read": true, "create": true, "update": true, "export": true}, "daybook": {"read": true, "create": true, "update": true, "export": true}, "admin_venue": {"read": true, "update": true}, "admin_roles": {"read": false}}'::jsonb),

('default', 'Supervisor', 'Operational oversight, limited editing, no approvals', true, true,
  '{"price_change_percent": 0, "po_amount": 0, "roster_over_percent": 0}'::jsonb,
  '{"inventory": {"read": true, "create": true, "update": true, "export": false}, "recipes": {"read": true}, "menu_items": {"read": true}, "purchasing": {"read": true, "create": true}, "workforce": {"read": true, "create": true, "update": true}, "time_attendance": {"read": true, "create": true, "update": true}, "insights": {"read": true}, "food_safety": {"read": true, "create": true, "update": true}, "daybook": {"read": true, "create": true, "update": true}}'::jsonb),

('default', 'Crew', 'Basic access to own shifts and assigned tasks', true, true,
  '{"price_change_percent": 0, "po_amount": 0, "roster_over_percent": 0}'::jsonb,
  '{"recipes": {"read": true}, "workforce": {"read": true}, "time_attendance": {"read": true, "create": true}, "food_safety": {"read": true, "create": true}, "daybook": {"read": true, "create": true}}'::jsonb);