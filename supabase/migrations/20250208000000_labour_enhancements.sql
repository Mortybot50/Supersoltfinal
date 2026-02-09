-- Labour Module Enhancements Migration
-- Adds shift_swap_requests, labor_budgets, shift_templates, and enhances roster_shifts

-- ============================================
-- 1. SHIFT TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,

  -- Template configuration
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  position TEXT NOT NULL DEFAULT 'crew',

  -- When to apply
  days_of_week INTEGER[] DEFAULT '{}',

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_shift_templates_org ON shift_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_templates_venue ON shift_templates(venue_id);

-- ============================================
-- 2. SHIFT SWAP REQUESTS
-- ============================================

CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  -- The shift being swapped
  original_shift_id UUID NOT NULL REFERENCES roster_shifts(id) ON DELETE CASCADE,
  original_staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  -- Target (null = open for anyone)
  target_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),

  -- Approval tracking
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id),
  rejection_reason TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_org ON shift_swap_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_venue ON shift_swap_requests(venue_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_original_shift ON shift_swap_requests(original_shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_status ON shift_swap_requests(status);

-- ============================================
-- 3. LABOR BUDGETS
-- ============================================

CREATE TABLE IF NOT EXISTS labor_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  -- Budget period
  period_type TEXT NOT NULL DEFAULT 'weekly' CHECK (period_type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Budget amounts (in cents)
  budgeted_amount INTEGER NOT NULL DEFAULT 0,
  actual_amount INTEGER DEFAULT 0,

  -- Revenue target for labor % calculation (in cents)
  revenue_target INTEGER,

  -- Thresholds for warnings (percent)
  warning_threshold_percent INTEGER DEFAULT 90,
  critical_threshold_percent INTEGER DEFAULT 100,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_labor_budgets_org ON labor_budgets(org_id);
CREATE INDEX IF NOT EXISTS idx_labor_budgets_venue ON labor_budgets(venue_id);
CREATE INDEX IF NOT EXISTS idx_labor_budgets_period ON labor_budgets(period_start, period_end);

-- ============================================
-- 4. ENHANCE ROSTER_SHIFTS
-- ============================================

-- Add penalty rate columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roster_shifts' AND column_name = 'base_cost') THEN
    ALTER TABLE roster_shifts ADD COLUMN base_cost DECIMAL(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roster_shifts' AND column_name = 'penalty_cost') THEN
    ALTER TABLE roster_shifts ADD COLUMN penalty_cost DECIMAL(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roster_shifts' AND column_name = 'penalty_type') THEN
    ALTER TABLE roster_shifts ADD COLUMN penalty_type TEXT DEFAULT 'none' CHECK (penalty_type IN ('none', 'saturday', 'sunday', 'public_holiday', 'late_night', 'early_morning'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roster_shifts' AND column_name = 'is_open_shift') THEN
    ALTER TABLE roster_shifts ADD COLUMN is_open_shift BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'roster_shifts' AND column_name = 'template_id') THEN
    ALTER TABLE roster_shifts ADD COLUMN template_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 5. ROSTER WARNINGS (for compliance tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS roster_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  shift_id UUID REFERENCES roster_shifts(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  -- Warning type
  warning_type TEXT NOT NULL CHECK (warning_type IN (
    'overtime_weekly', 'overtime_daily', 'rest_gap', 'break_required',
    'availability_conflict', 'qualification_missing', 'minor_hours', 'budget_exceeded'
  )),
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,

  -- Additional context
  details JSONB,

  -- Resolution
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES profiles(id),
  acknowledged_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roster_warnings_org ON roster_warnings(org_id);
CREATE INDEX IF NOT EXISTS idx_roster_warnings_venue ON roster_warnings(venue_id);
CREATE INDEX IF NOT EXISTS idx_roster_warnings_staff ON roster_warnings(staff_id);
CREATE INDEX IF NOT EXISTS idx_roster_warnings_shift ON roster_warnings(shift_id);

-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_warnings ENABLE ROW LEVEL SECURITY;

-- Shift templates policies
CREATE POLICY "Members can view shift_templates" ON shift_templates FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage shift_templates" ON shift_templates FOR ALL USING (is_org_admin(org_id));

-- Shift swap requests policies
CREATE POLICY "Members can view shift_swap_requests" ON shift_swap_requests FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Members can create shift_swap_requests" ON shift_swap_requests FOR INSERT WITH CHECK (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage shift_swap_requests" ON shift_swap_requests FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can delete shift_swap_requests" ON shift_swap_requests FOR DELETE USING (is_org_admin(org_id));

-- Labor budgets policies
CREATE POLICY "Members can view labor_budgets" ON labor_budgets FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage labor_budgets" ON labor_budgets FOR ALL USING (is_org_admin(org_id));

-- Roster warnings policies
CREATE POLICY "Members can view roster_warnings" ON roster_warnings FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));
CREATE POLICY "Admins can manage roster_warnings" ON roster_warnings FOR ALL USING (is_org_admin(org_id));

-- ============================================
-- 7. TRIGGERS
-- ============================================

-- Update timestamps
DROP TRIGGER IF EXISTS update_shift_templates_updated_at ON shift_templates;
CREATE TRIGGER update_shift_templates_updated_at
  BEFORE UPDATE ON shift_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shift_swap_requests_updated_at ON shift_swap_requests;
CREATE TRIGGER update_shift_swap_requests_updated_at
  BEFORE UPDATE ON shift_swap_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_labor_budgets_updated_at ON labor_budgets;
CREATE TRIGGER update_labor_budgets_updated_at
  BEFORE UPDATE ON labor_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
