-- Public Holidays Table + Seed Data
-- Supports national + state-specific AU holidays for penalty rate calculations

-- ============================================
-- 1. PUBLIC HOLIDAYS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Holiday details
  name TEXT NOT NULL,
  date DATE NOT NULL,
  state TEXT, -- NULL = national, otherwise 'VIC', 'NSW', 'QLD', etc.
  is_national BOOLEAN NOT NULL DEFAULT false,

  -- Custom holidays
  is_custom BOOLEAN NOT NULL DEFAULT false, -- org-defined holidays

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_org ON public_holidays(org_id);
CREATE INDEX IF NOT EXISTS idx_public_holidays_state ON public_holidays(state);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

-- National/state holidays (no org_id) are visible to everyone
CREATE POLICY "Anyone can view system holidays" ON public_holidays
  FOR SELECT USING (org_id IS NULL);

-- Org-specific custom holidays
CREATE POLICY "Members can view org holidays" ON public_holidays
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "Admins can manage org holidays" ON public_holidays
  FOR ALL USING (is_org_admin(org_id));

-- ============================================
-- 3. SEED 2025 NATIONAL HOLIDAYS
-- ============================================

INSERT INTO public_holidays (name, date, is_national) VALUES
  ('New Year''s Day', '2025-01-01', true),
  ('Australia Day', '2025-01-27', true),
  ('Good Friday', '2025-04-18', true),
  ('Saturday before Easter Sunday', '2025-04-19', true),
  ('Easter Sunday', '2025-04-20', true),
  ('Easter Monday', '2025-04-21', true),
  ('Anzac Day', '2025-04-25', true),
  ('Queen''s Birthday', '2025-06-09', true),
  ('Christmas Day', '2025-12-25', true),
  ('Boxing Day', '2025-12-26', true);

-- 2025 VIC-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Melbourne Cup Day', '2025-11-04', 'VIC'),
  ('AFL Grand Final Friday', '2025-09-26', 'VIC');

-- 2025 NSW-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Bank Holiday', '2025-08-04', 'NSW');

-- 2025 QLD-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Royal Queensland Show', '2025-08-13', 'QLD');

-- 2025 SA-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Adelaide Cup', '2025-03-10', 'SA'),
  ('Proclamation Day', '2025-12-24', 'SA');

-- 2025 WA-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Western Australia Day', '2025-06-02', 'WA');

-- 2025 TAS-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Royal Hobart Regatta', '2025-02-10', 'TAS');

-- 2025 ACT-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Canberra Day', '2025-03-10', 'ACT'),
  ('Reconciliation Day', '2025-05-26', 'ACT'),
  ('Family & Community Day', '2025-09-29', 'ACT');

-- 2025 NT-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('May Day', '2025-05-05', 'NT'),
  ('Show Day', '2025-07-11', 'NT'),
  ('Picnic Day', '2025-08-04', 'NT');

-- ============================================
-- 4. SEED 2026 NATIONAL HOLIDAYS
-- ============================================

INSERT INTO public_holidays (name, date, is_national) VALUES
  ('New Year''s Day', '2026-01-01', true),
  ('Australia Day', '2026-01-26', true),
  ('Good Friday', '2026-04-03', true),
  ('Saturday before Easter Sunday', '2026-04-04', true),
  ('Easter Sunday', '2026-04-05', true),
  ('Easter Monday', '2026-04-06', true),
  ('Anzac Day', '2026-04-25', true),
  ('Queen''s Birthday', '2026-06-08', true),
  ('Christmas Day', '2026-12-25', true),
  ('Boxing Day', '2026-12-26', true);

-- 2026 VIC-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Melbourne Cup Day', '2026-11-03', 'VIC'),
  ('AFL Grand Final Friday', '2026-09-25', 'VIC');

-- 2026 NSW-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Bank Holiday', '2026-08-03', 'NSW');

-- 2026 QLD-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Royal Queensland Show', '2026-08-12', 'QLD');

-- 2026 SA-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Adelaide Cup', '2026-03-09', 'SA'),
  ('Proclamation Day', '2026-12-24', 'SA');

-- 2026 WA-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Western Australia Day', '2026-06-01', 'WA');

-- 2026 ACT-specific
INSERT INTO public_holidays (name, date, state) VALUES
  ('Canberra Day', '2026-03-09', 'ACT'),
  ('Reconciliation Day', '2026-05-25', 'ACT'),
  ('Family & Community Day', '2026-09-28', 'ACT');

-- ============================================
-- 5. TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_public_holidays_updated_at ON public_holidays;
CREATE TRIGGER update_public_holidays_updated_at
  BEFORE UPDATE ON public_holidays
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
