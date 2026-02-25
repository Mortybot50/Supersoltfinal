-- ============================================
-- Migration: Add missing indexes for common query patterns
-- Date: 2026-02-25
-- Audit item #9
-- ============================================

-- timesheets: commonly queried by staff, venue, status, and date
CREATE INDEX IF NOT EXISTS idx_timesheets_staff ON timesheets(staff_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_venue ON timesheets(venue_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(status);
CREATE INDEX IF NOT EXISTS idx_timesheets_org ON timesheets(org_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(work_date);

-- roster_shifts: commonly queried by staff, date, venue, status
CREATE INDEX IF NOT EXISTS idx_roster_shifts_staff ON roster_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_date ON roster_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_venue ON roster_shifts(venue_id);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_status ON roster_shifts(status);
CREATE INDEX IF NOT EXISTS idx_roster_shifts_org_date ON roster_shifts(org_id, shift_date);

-- recipe_ingredients: commonly joined on ingredient_id and recipe_id
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);

-- purchase_order_items: commonly joined on ingredient_id
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_ingredient ON purchase_order_items(ingredient_id);

-- staff: commonly queried by org_member_id and venue
CREATE INDEX IF NOT EXISTS idx_staff_org_member ON staff(org_member_id);

-- shift_swap_requests: commonly queried by status and org
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_org ON shift_swap_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_swap_requests_status ON shift_swap_requests(status);

-- shift_templates: commonly queried by venue
CREATE INDEX IF NOT EXISTS idx_shift_templates_venue ON shift_templates(venue_id);
CREATE INDEX IF NOT EXISTS idx_shift_templates_org ON shift_templates(org_id);

-- labor_budgets: commonly queried by venue and period
CREATE INDEX IF NOT EXISTS idx_labor_budgets_venue ON labor_budgets(venue_id);
CREATE INDEX IF NOT EXISTS idx_labor_budgets_org ON labor_budgets(org_id);

-- orders: commonly filtered by date range
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- org_members: commonly queried by user_id
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);

-- ingredient_price_history: commonly joined on ingredient_id + date
CREATE INDEX IF NOT EXISTS idx_ingredient_price_history_ingredient ON ingredient_price_history(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_price_history_date ON ingredient_price_history(changed_at DESC);

-- pos_connections: commonly queried by org
CREATE INDEX IF NOT EXISTS idx_pos_connections_org ON pos_connections(org_id);

-- menu_sections: commonly queried by org
CREATE INDEX IF NOT EXISTS idx_menu_sections_org ON menu_sections(org_id);
