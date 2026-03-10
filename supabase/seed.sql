-- ============================================================
-- SuperSolt Staging Seed — Phase 2 Additions
-- Date: 2026-03-11
-- Purpose: E2E validation seed — adds all data missing from
--          migration 20260308000001_venue_setup_and_seed.sql
-- Idempotent: Uses ON CONFLICT DO NOTHING throughout
-- ============================================================
-- Known IDs (established by prior migrations):
--   ORG:      7062ac24-a551-458c-8c94-9d2c396024f9  (Piccolo Panini Bar)
--   HAW VID:  894d69a2-ba06-4887-8bac-cac66ce24c59  (PPB Hawthorn)
--   SY  VID:  b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c  (PPB South Yarra)
--   MORTY:    a6943bd2-1f31-4682-b669-894ac2e3be5e  (admin user)
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- SECTION 1: ORG & VENUE SETTINGS
-- Populate trading hours, pos_settings, etc.
-- ═══════════════════════════════════════════════════════════

UPDATE venues
SET
  trading_hours = '{
    "monday":    {"open": "07:00", "close": "15:00"},
    "tuesday":   {"open": "07:00", "close": "15:00"},
    "wednesday": {"open": "07:00", "close": "15:00"},
    "thursday":  {"open": "07:00", "close": "15:00"},
    "friday":    {"open": "07:00", "close": "16:00"},
    "saturday":  {"open": "08:00", "close": "15:00"},
    "sunday":    {"open": "08:00", "close": "14:00"}
  }',
  venue_type = 'cafe',
  updated_at = now()
WHERE id = '894d69a2-ba06-4887-8bac-cac66ce24c59';

UPDATE venues
SET
  trading_hours = '{
    "monday":    {"open": "07:00", "close": "22:00"},
    "tuesday":   {"open": "07:00", "close": "22:00"},
    "wednesday": {"open": "07:00", "close": "22:00"},
    "thursday":  {"open": "07:00", "close": "22:00"},
    "friday":    {"open": "07:00", "close": "23:00"},
    "saturday":  {"open": "08:00", "close": "23:00"},
    "sunday":    {"open": "08:00", "close": "21:00"}
  }',
  venue_type = 'restaurant',
  updated_at = now()
WHERE id = 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c';


-- ═══════════════════════════════════════════════════════════
-- SECTION 2: RECIPES — 10 shared org-level recipes
-- cost_per_serve in CENTS; gp_target_percent = %
-- Ingredients reference SY venue IDs (org-level recipes
-- are shared; UI derives cost from ingredient costs)
-- ═══════════════════════════════════════════════════════════

INSERT INTO recipes (id, org_id, name, description, category, status, batch_yield, cost_per_serve, gp_target_percent, version, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-4000-8000-000000000001', '7062ac24-a551-458c-8c94-9d2c396024f9',
   'Eggs Benedict',
   'Two poached eggs, streaky bacon, hollandaise sauce on toasted English muffin.',
   'mains', 'active', 1, 562, 72, 1, now(), now()),

  ('aaaaaaaa-aaaa-4000-8000-000000000002', '7062ac24-a551-458c-8c94-9d2c396024f9',
   'Avocado Toast with Feta',
   'Smashed avocado, crumbled feta, chilli flakes, microgreens on sourdough.',
   'mains', 'active', 1, 532, 70, 1, now(), now()),

  ('aaaaaaaa-aaaa-4000-8000-000000000003', '7062ac24-a551-458c-8c94-9d2c396024f9',
   'Full Breakfast',
   'Streaky bacon, two eggs your way, hash browns, sautéed mushrooms, roma tomato, baby spinach.',
   'mains', 'active', 1, 808, 69, 1, now(), now()),

  ('aaaaaaaa-aaaa-4000-8000-000000000004', '7062ac24-a551-458c-8c94-9d2c396024f9',
   'Flat White',
   'Double ristretto, steamed full cream or oat milk. 220mL.',
   'beverages', 'active', 1, 106, 79, 1, now(), now()),

  ('aaaaaaaa-aaaa-4000-8000-000000000005', '7062ac24-a551-458c-8c94-9d2c396024f9',
   'Oat Milk Latte',
   'Double ristretto, steamed Oatly oat milk. 280mL.',
   'beverages', 'active', 1, 158, 74, 1, now(), now()),

  ('aaaaaaaa-aaaa-4000-8000-000000000006', '7062ac24-a551-458c-8c94-9d2c396024f9',
   'Chicken Caesar Salad',
   'Grilled chicken, cos lettuce, crispy bacon, shaved parmesan, house caesar dressing, croutons.',
   'mains', 'active', 1, 540, 77, 1, now(), now()),

  ('aaaaaaaa-aaaa-4000-8000-000000000007', '7062ac24-a551-458c-8c94-9d2c396024f9',
   'Smoked Salmon Bagel',
   'Hot-smoked salmon, whipped feta, baby capers, red onion jam, baby spinach on toasted bagel.',
   'mains', 'active', 1, 570, 80, 1, now(), now()),

  ('aaaaaaaa-aaaa-4000-8000-000000000008', '7062ac24-a551-458c-8c94-9d2c396024f9',
   'Haloumi Stack',
   'Pan-fried haloumi, baby spinach, roasted roma tomatoes, pesto, balsamic glaze.',
   'mains', 'active', 1, 508, 75, 1, now(), now()),

  ('aaaaaaaa-aaaa-4000-8000-000000000009', '7062ac24-a551-458c-8c94-9d2c396024f9',
   'Acai Bowl',
   'Blended acai, banana, mixed berries, granola, fresh fruit, raw honey, coconut flakes.',
   'mains', 'active', 1, 620, 67, 1, now(), now()),

  ('aaaaaaaa-aaaa-4000-8000-000000000010', '7062ac24-a551-458c-8c94-9d2c396024f9',
   'Banana Bread (slice)',
   'House-made banana bread, served warm with whipped butter.',
   'desserts', 'active', 1, 180, 78, 1, now(), now())

ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SECTION 3: RECIPE INGREDIENTS
-- quantity in recipe_unit; cost in CENTS
-- ═══════════════════════════════════════════════════════════

INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, cost, sort_order)
VALUES
  -- Eggs Benedict (recipe 0001) — SY ingredients
  ('dddddddd-aaaa-4000-8000-000000000001', 'aaaaaaaa-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000002', 0.2,  'kg',    90,  1),  -- sourdough
  ('dddddddd-aaaa-4000-8000-000000000002', 'aaaaaaaa-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000004', 0.15, 'kg',   270, 2),  -- bacon
  ('dddddddd-aaaa-4000-8000-000000000003', 'aaaaaaaa-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000005', 2,    'each',  92,  3),  -- eggs (2/12 dozen)
  ('dddddddd-aaaa-4000-8000-000000000004', 'aaaaaaaa-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000020', 0.1,  'L',    200, 4),  -- hollandaise

  -- Avocado Toast with Feta (recipe 0002)
  ('dddddddd-aaaa-4000-8000-000000000005', 'aaaaaaaa-aaaa-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000002', 0.15, 'kg',    68,  1),  -- sourdough
  ('dddddddd-aaaa-4000-8000-000000000006', 'aaaaaaaa-aaaa-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000003', 1.5,  'each', 375, 2),  -- avocado
  ('dddddddd-aaaa-4000-8000-000000000007', 'aaaaaaaa-aaaa-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000018', 0.05, 'kg',    90,  3),  -- feta

  -- Full Breakfast (recipe 0003)
  ('dddddddd-aaaa-4000-8000-000000000008', 'aaaaaaaa-aaaa-4000-8000-000000000003', '66666666-bbbb-4000-8000-000000000004', 0.2,  'kg',   360, 1),  -- bacon
  ('dddddddd-aaaa-4000-8000-000000000009', 'aaaaaaaa-aaaa-4000-8000-000000000003', '66666666-bbbb-4000-8000-000000000005', 2,    'each', 138, 2),  -- eggs (2 portions of 1/12 dozen)
  ('dddddddd-aaaa-4000-8000-000000000010', 'aaaaaaaa-aaaa-4000-8000-000000000003', '66666666-bbbb-4000-8000-000000000019', 0.15, 'kg',    90,  3),  -- hash browns
  ('dddddddd-aaaa-4000-8000-000000000011', 'aaaaaaaa-aaaa-4000-8000-000000000003', '66666666-bbbb-4000-8000-000000000011', 0.1,  'kg',    90,  4),  -- mushrooms
  ('dddddddd-aaaa-4000-8000-000000000012', 'aaaaaaaa-aaaa-4000-8000-000000000003', '66666666-bbbb-4000-8000-000000000008', 0.1,  'kg',    50,  5),  -- tomatoes
  ('dddddddd-aaaa-4000-8000-000000000013', 'aaaaaaaa-aaaa-4000-8000-000000000003', '66666666-bbbb-4000-8000-000000000012', 0.05, 'kg',    80,  6),  -- baby spinach

  -- Flat White (recipe 0004)
  ('dddddddd-aaaa-4000-8000-000000000014', 'aaaaaaaa-aaaa-4000-8000-000000000004', '66666666-bbbb-4000-8000-000000000013', 0.02, 'kg',    70,  1),  -- coffee beans
  ('dddddddd-aaaa-4000-8000-000000000015', 'aaaaaaaa-aaaa-4000-8000-000000000004', '66666666-bbbb-4000-8000-000000000014', 0.2,  'L',     36,  2),  -- full cream milk

  -- Oat Milk Latte (recipe 0005)
  ('dddddddd-aaaa-4000-8000-000000000016', 'aaaaaaaa-aaaa-4000-8000-000000000005', '66666666-bbbb-4000-8000-000000000013', 0.02, 'kg',    70,  1),  -- coffee beans
  ('dddddddd-aaaa-4000-8000-000000000017', 'aaaaaaaa-aaaa-4000-8000-000000000005', '66666666-bbbb-4000-8000-000000000015', 0.25, 'L',     88,  2),  -- oat milk

  -- Chicken Caesar Salad (recipe 0006)
  ('dddddddd-aaaa-4000-8000-000000000018', 'aaaaaaaa-aaaa-4000-8000-000000000006', '66666666-bbbb-4000-8000-000000000001', 0.2,  'kg',   240, 1),  -- chicken breast
  ('dddddddd-aaaa-4000-8000-000000000019', 'aaaaaaaa-aaaa-4000-8000-000000000006', '66666666-bbbb-4000-8000-000000000007', 0.15, 'kg',   210, 2),  -- mixed salad leaves
  ('dddddddd-aaaa-4000-8000-000000000020', 'aaaaaaaa-aaaa-4000-8000-000000000006', '66666666-bbbb-4000-8000-000000000004', 0.05, 'kg',    90,  3),  -- bacon

  -- Smoked Salmon Bagel (recipe 0007)
  ('dddddddd-aaaa-4000-8000-000000000021', 'aaaaaaaa-aaaa-4000-8000-000000000007', '66666666-bbbb-4000-8000-000000000009', 0.1,  'kg',   450, 1),  -- smoked salmon
  ('dddddddd-aaaa-4000-8000-000000000022', 'aaaaaaaa-aaaa-4000-8000-000000000007', '66666666-bbbb-4000-8000-000000000018', 0.04, 'kg',    72,  2),  -- feta
  ('dddddddd-aaaa-4000-8000-000000000023', 'aaaaaaaa-aaaa-4000-8000-000000000007', '66666666-bbbb-4000-8000-000000000012', 0.03, 'kg',    48,  3),  -- baby spinach

  -- Haloumi Stack (recipe 0008)
  ('dddddddd-aaaa-4000-8000-000000000024', 'aaaaaaaa-aaaa-4000-8000-000000000008', '66666666-bbbb-4000-8000-000000000006', 0.15, 'kg',   330, 1),  -- haloumi
  ('dddddddd-aaaa-4000-8000-000000000025', 'aaaaaaaa-aaaa-4000-8000-000000000008', '66666666-bbbb-4000-8000-000000000012', 0.08, 'kg',   128, 2),  -- baby spinach
  ('dddddddd-aaaa-4000-8000-000000000026', 'aaaaaaaa-aaaa-4000-8000-000000000008', '66666666-bbbb-4000-8000-000000000008', 0.1,  'kg',    50,  3),  -- roma tomatoes

  -- Acai Bowl (recipe 0009) — uses honey from SY
  ('dddddddd-aaaa-4000-8000-000000000027', 'aaaaaaaa-aaaa-4000-8000-000000000009', '66666666-bbbb-4000-8000-000000000023', 0.03, 'kg',    96,  1),  -- raw honey
  ('dddddddd-aaaa-4000-8000-000000000028', 'aaaaaaaa-aaaa-4000-8000-000000000009', '66666666-bbbb-4000-8000-000000000003', 0.5,  'each', 125, 2),  -- avocado (sub banana)

  -- Banana Bread (recipe 0010) — minimal ingredients
  ('dddddddd-aaaa-4000-8000-000000000029', 'aaaaaaaa-aaaa-4000-8000-000000000010', '66666666-bbbb-4000-8000-000000000005', 0.5,  'each',  23,  1)   -- eggs

ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SECTION 4: MENU SECTIONS (org-level)
-- ═══════════════════════════════════════════════════════════

INSERT INTO menu_sections (id, org_id, name, sort_order, created_at, updated_at)
VALUES
  ('bbbbbbbb-aaaa-4000-8000-000000000001', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Breakfast & Brunch', 1, now(), now()),
  ('bbbbbbbb-aaaa-4000-8000-000000000002', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Mains',              2, now(), now()),
  ('bbbbbbbb-aaaa-4000-8000-000000000003', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Beverages',          3, now(), now()),
  ('bbbbbbbb-aaaa-4000-8000-000000000004', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Desserts',           4, now(), now())
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SECTION 5: MENU ITEMS — Hawthorn venue
-- selling_price + cost_price in CENTS
-- margin_percent = (selling_price - cost_price) / selling_price * 100
-- ═══════════════════════════════════════════════════════════

INSERT INTO menu_items (id, venue_id, name, description, category, menu_group, selling_price, cost_price, margin_percent, active, created_at, updated_at)
VALUES
  -- Breakfast & Brunch
  ('cccccccc-aaaa-4000-8000-000000000001', '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'Eggs Benedict', 'Two poached eggs, streaky bacon, hollandaise on toasted muffin.',
   'Breakfast & Brunch', 'food', 2200, 562, 74, true, now(), now()),

  ('cccccccc-aaaa-4000-8000-000000000002', '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'Avocado Toast with Feta', 'Smashed avo, crumbled feta, chilli, microgreens on sourdough.',
   'Breakfast & Brunch', 'food', 1800, 532, 70, true, now(), now()),

  ('cccccccc-aaaa-4000-8000-000000000003', '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'Full Breakfast', 'Bacon, eggs, hash browns, mushrooms, tomato, baby spinach.',
   'Breakfast & Brunch', 'food', 2600, 808, 69, true, now(), now()),

  ('cccccccc-aaaa-4000-8000-000000000004', '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'Banana Bread', 'House-made banana bread, warm with whipped butter.',
   'Breakfast & Brunch', 'food', 900, 180, 80, true, now(), now()),

  -- Mains
  ('cccccccc-aaaa-4000-8000-000000000005', '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'Chicken Caesar Salad', 'Grilled chicken, cos lettuce, bacon, parmesan, caesar dressing.',
   'Mains', 'food', 2400, 540, 77, true, now(), now()),

  ('cccccccc-aaaa-4000-8000-000000000006', '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'Smoked Salmon Bagel', 'Hot-smoked salmon, whipped feta, baby capers, baby spinach.',
   'Mains', 'food', 2800, 570, 79, true, now(), now()),

  ('cccccccc-aaaa-4000-8000-000000000007', '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'Haloumi Stack', 'Pan-fried haloumi, baby spinach, roasted tomatoes, pesto, balsamic.',
   'Mains', 'food', 2000, 508, 74, true, now(), now()),

  -- Beverages
  ('cccccccc-aaaa-4000-8000-000000000008', '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'Flat White', 'Double ristretto, steamed full cream milk. 220mL.',
   'Beverages', 'beverages', 500, 106, 79, true, now(), now()),

  ('cccccccc-aaaa-4000-8000-000000000009', '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'Oat Milk Latte', 'Double ristretto, steamed Oatly. 280mL.',
   'Beverages', 'beverages', 600, 158, 74, true, now(), now()),

  ('cccccccc-aaaa-4000-8000-000000000010', '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'Acai Bowl', 'Blended acai, banana, granola, fresh fruit, raw honey, coconut flakes.',
   'Mains', 'food', 1900, 620, 67, true, now(), now())

ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SECTION 6: MENU ITEMS — South Yarra venue
-- ═══════════════════════════════════════════════════════════

INSERT INTO menu_items (id, venue_id, name, description, category, menu_group, selling_price, cost_price, margin_percent, active, created_at, updated_at)
VALUES
  ('cccccccc-bbbb-4000-8000-000000000001', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
   'Eggs Benedict', 'Two poached eggs, streaky bacon, hollandaise on toasted muffin.',
   'Breakfast & Brunch', 'food', 2400, 562, 77, true, now(), now()),

  ('cccccccc-bbbb-4000-8000-000000000002', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
   'Smashed Avo with Feta', 'Smashed avo, feta, pomegranate, microgreens on sourdough.',
   'Breakfast & Brunch', 'food', 2000, 532, 73, true, now(), now()),

  ('cccccccc-bbbb-4000-8000-000000000003', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
   'Full Breakfast', 'Bacon, eggs, hash browns, mushrooms, tomato, baby spinach.',
   'Breakfast & Brunch', 'food', 2800, 808, 71, true, now(), now()),

  ('cccccccc-bbbb-4000-8000-000000000004', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
   'Wagyu Smash Burger', 'Wagyu beef patty, caramelised onion, American cheese, pickles, special sauce on brioche.',
   'Mains', 'food', 3600, 510, 86, true, now(), now()),

  ('cccccccc-bbbb-4000-8000-000000000005', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
   'Prosciutto & Mozzarella Panini', 'Prosciutto, fresh mozzarella, roasted capsicum, rocket, balsamic on ciabatta.',
   'Mains', 'food', 2800, 381, 86, true, now(), now()),

  ('cccccccc-bbbb-4000-8000-000000000006', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
   'Smoked Salmon Bagel', 'Hot-smoked salmon, whipped feta, baby capers, dill.',
   'Mains', 'food', 3000, 570, 81, true, now(), now()),

  ('cccccccc-bbbb-4000-8000-000000000007', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
   'Flat White', 'Double ristretto, steamed full cream milk. 220mL.',
   'Beverages', 'beverages', 500, 106, 79, true, now(), now()),

  ('cccccccc-bbbb-4000-8000-000000000008', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
   'Oat Milk Latte', 'Double ristretto, steamed Oatly. 280mL.',
   'Beverages', 'beverages', 600, 158, 74, true, now(), now())

ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SECTION 7: PURCHASE ORDERS — Hawthorn + South Yarra
-- order_date / expected_delivery_date stored as ISO
-- status: draft | submitted | confirmed | delivered | cancelled
-- ═══════════════════════════════════════════════════════════

INSERT INTO purchase_orders (id, po_number, org_id, venue_id, supplier_id, supplier_name, order_date, expected_delivery_date, status, subtotal, tax_amount, total_amount, notes, created_by, created_by_name, delivered_at, created_at, updated_at)
VALUES
  -- HAW PO-001: Bidfood — delivered last week
  ('eeeeeeee-aaaa-4000-8000-000000000001',
   'PO-HAW-2026-001',
   '7062ac24-a551-458c-8c94-9d2c396024f9',
   '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'beeefaaa-f47a-48a4-bd46-85de440d9259',
   'Bidfood Melbourne',
   '2026-02-24T09:00:00+11:00',
   '2026-02-26T08:00:00+11:00',
   'delivered',
   49500, 4950, 54450,
   'Weekly dry goods order.',
   'a6943bd2-1f31-4682-b669-894ac2e3be5e',
   'Morty (Admin)',
   '2026-02-26T09:30:00+11:00',
   '2026-02-24T09:00:00+11:00', '2026-02-26T09:30:00+11:00'),

  -- HAW PO-002: La Manna Fresh — submitted this week
  ('eeeeeeee-aaaa-4000-8000-000000000002',
   'PO-HAW-2026-002',
   '7062ac24-a551-458c-8c94-9d2c396024f9',
   '894d69a2-ba06-4887-8bac-cac66ce24c59',
   '178f0bd7-5f83-4307-a4c7-e13e478aac09',
   'La Manna Fresh',
   '2026-03-09T07:30:00+11:00',
   '2026-03-10T07:00:00+11:00',
   'submitted',
   22000, 2200, 24200,
   'Produce for the week.',
   'a6943bd2-1f31-4682-b669-894ac2e3be5e',
   'Morty (Admin)',
   NULL,
   '2026-03-09T07:30:00+11:00', '2026-03-09T07:30:00+11:00'),

  -- HAW PO-003: Vics Premium Meat — draft
  ('eeeeeeee-aaaa-4000-8000-000000000003',
   'PO-HAW-2026-003',
   '7062ac24-a551-458c-8c94-9d2c396024f9',
   '894d69a2-ba06-4887-8bac-cac66ce24c59',
   '55555555-aaaa-4000-8000-000000000006',
   'Vics Premium Quality Meat',
   '2026-03-10T10:00:00+11:00',
   '2026-03-12T08:00:00+11:00',
   'draft',
   33000, 3300, 36300,
   'Protein restock — needs approval.',
   'a6943bd2-1f31-4682-b669-894ac2e3be5e',
   'Morty (Admin)',
   NULL,
   '2026-03-10T10:00:00+11:00', '2026-03-10T10:00:00+11:00'),

  -- SY PO-001: PFD Food Services — delivered
  ('eeeeeeee-bbbb-4000-8000-000000000001',
   'PO-SY-2026-001',
   '7062ac24-a551-458c-8c94-9d2c396024f9',
   'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
   '0982205c-6847-4554-b7e9-a7111901cdc6',
   'PFD Food Services',
   '2026-02-25T08:00:00+11:00',
   '2026-02-27T08:00:00+11:00',
   'delivered',
   62700, 6270, 68970,
   'Salmon, coffee beans, condiments.',
   'a6943bd2-1f31-4682-b669-894ac2e3be5e',
   'Morty (Admin)',
   '2026-02-27T09:00:00+11:00',
   '2026-02-25T08:00:00+11:00', '2026-02-27T09:00:00+11:00'),

  -- SY PO-002: Bidfood — submitted
  ('eeeeeeee-bbbb-4000-8000-000000000002',
   'PO-SY-2026-002',
   '7062ac24-a551-458c-8c94-9d2c396024f9',
   'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
   'beeefaaa-f47a-48a4-bd46-85de440d9259',
   'Bidfood Melbourne',
   '2026-03-09T07:00:00+11:00',
   '2026-03-11T07:00:00+11:00',
   'submitted',
   41800, 4180, 45980,
   'Dairy, dry goods restock.',
   'a6943bd2-1f31-4682-b669-894ac2e3be5e',
   'Morty (Admin)',
   NULL,
   '2026-03-09T07:00:00+11:00', '2026-03-09T07:00:00+11:00')

ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SECTION 8: PURCHASE ORDER ITEMS
-- unit_cost in CENTS; line_total in CENTS
-- ═══════════════════════════════════════════════════════════

INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, ingredient_name, quantity_ordered, unit, unit_cost, line_total, created_at)
VALUES
  -- HAW PO-001 (Bidfood — delivered)
  ('ffffffff-aaaa-4000-8000-000000000001', 'eeeeeeee-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000014', 'Full Cream Milk',   30,   'litre', 180,  5400,  now()),
  ('ffffffff-aaaa-4000-8000-000000000002', 'eeeeeeee-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000015', 'Oat Milk',          20,   'litre', 350,  7000,  now()),
  ('ffffffff-aaaa-4000-8000-000000000003', 'eeeeeeee-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000016', 'Olive Oil',         5,    'litre', 1200, 6000,  now()),
  ('ffffffff-aaaa-4000-8000-000000000004', 'eeeeeeee-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000019', 'Hash Browns',       10,   'kg',    600,  6000,  now()),
  ('ffffffff-aaaa-4000-8000-000000000005', 'eeeeeeee-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000004', 'Streaky Bacon',     8,    'kg',    1800, 14400, now()),
  ('ffffffff-aaaa-4000-8000-000000000006', 'eeeeeeee-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000001', 'Chicken Breast',    8,    'kg',    1200, 9600,  now()),
  ('ffffffff-aaaa-4000-8000-000000000007', 'eeeeeeee-aaaa-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000017', 'Pesto',             2,    'kg',    2800, 5600,  now()),

  -- HAW PO-002 (La Manna — submitted)
  ('ffffffff-aaaa-4000-8000-000000000008', 'eeeeeeee-aaaa-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000003', 'Avocado',           20,   'each',  250,  5000,  now()),
  ('ffffffff-aaaa-4000-8000-000000000009', 'eeeeeeee-aaaa-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000005', 'Free Range Eggs',   10,   'dozen', 550,  5500,  now()),
  ('ffffffff-aaaa-4000-8000-000000000010', 'eeeeeeee-aaaa-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000008', 'Roma Tomatoes',     8,    'kg',    500,  4000,  now()),
  ('ffffffff-aaaa-4000-8000-000000000011', 'eeeeeeee-aaaa-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000011', 'Mushrooms',         5,    'kg',    900,  4500,  now()),
  ('ffffffff-aaaa-4000-8000-000000000012', 'eeeeeeee-aaaa-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000012', 'Baby Spinach',      2,    'kg',    1600, 3200,  now()),

  -- HAW PO-003 (Vics — draft)
  ('ffffffff-aaaa-4000-8000-000000000013', 'eeeeeeee-aaaa-4000-8000-000000000003', '66666666-bbbb-4000-8000-000000000004', 'Streaky Bacon',     10,   'kg',    1800, 18000, now()),
  ('ffffffff-aaaa-4000-8000-000000000014', 'eeeeeeee-aaaa-4000-8000-000000000003', '66666666-aaaa-4000-8000-000000000004', 'Lamb Mince',        8,    'kg',    1600, 12800, now()),
  ('ffffffff-aaaa-4000-8000-000000000015', 'eeeeeeee-aaaa-4000-8000-000000000003', '66666666-aaaa-4000-8000-000000000005', 'Prosciutto',        0.4,  'kg',    5500, 2200,  now()),

  -- SY PO-001 (PFD — delivered)
  ('ffffffff-bbbb-4000-8000-000000000001', 'eeeeeeee-bbbb-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000009', 'Smoked Salmon',     10,   'kg',    4500, 45000, now()),
  ('ffffffff-bbbb-4000-8000-000000000002', 'eeeeeeee-bbbb-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000013', 'Coffee Beans',      4,    'kg',    3500, 14000, now()),
  ('ffffffff-bbbb-4000-8000-000000000003', 'eeeeeeee-bbbb-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000020', 'Hollandaise Sauce', 1,    'litre', 2000, 2000,  now()),
  ('ffffffff-bbbb-4000-8000-000000000004', 'eeeeeeee-bbbb-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000017', 'Pesto',             0.5,  'kg',    2800, 1400,  now()),
  ('ffffffff-bbbb-4000-8000-000000000005', 'eeeeeeee-bbbb-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000018', 'Feta Cheese',       1.5,  'kg',    1800, 2700,  now()),

  -- SY PO-002 (Bidfood — submitted)
  ('ffffffff-bbbb-4000-8000-000000000006', 'eeeeeeee-bbbb-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000014', 'Full Cream Milk',   50,   'litre', 180,  9000,  now()),
  ('ffffffff-bbbb-4000-8000-000000000007', 'eeeeeeee-bbbb-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000015', 'Oat Milk',          30,   'litre', 350,  10500, now()),
  ('ffffffff-bbbb-4000-8000-000000000008', 'eeeeeeee-bbbb-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000004', 'Streaky Bacon',     10,   'kg',    1800, 18000, now()),
  ('ffffffff-bbbb-4000-8000-000000000009', 'eeeeeeee-bbbb-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000001', 'Chicken Breast',    5,    'kg',    1200, 6000,  now())

ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SECTION 9: STOCK COUNTS — Hawthorn venue
-- ═══════════════════════════════════════════════════════════

INSERT INTO stock_counts (id, org_id, venue_id, count_number, count_date, counted_by_user_id, counted_by_name, status, total_variance_value, notes, created_at, updated_at)
VALUES
  ('99999999-aaaa-4000-8000-000000000001',
   '7062ac24-a551-458c-8c94-9d2c396024f9',
   '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'SC-HAW-2026-001', '2026-02-28',
   'a6943bd2-1f31-4682-b669-894ac2e3be5e', 'Morty (Admin)',
   'completed', -3200,
   'End of Feb full stocktake. Minor variances in produce.',
   '2026-02-28T15:00:00+11:00', '2026-02-28T17:00:00+11:00'),

  ('99999999-aaaa-4000-8000-000000000002',
   '7062ac24-a551-458c-8c94-9d2c396024f9',
   '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'SC-HAW-2026-002', '2026-03-07',
   'a6943bd2-1f31-4682-b669-894ac2e3be5e', 'Morty (Admin)',
   'completed', -1200,
   'Protein & dairy cycle count. Bacon variance noted.',
   '2026-03-07T14:30:00+11:00', '2026-03-07T15:30:00+11:00'),

  ('99999999-aaaa-4000-8000-000000000003',
   '7062ac24-a551-458c-8c94-9d2c396024f9',
   '894d69a2-ba06-4887-8bac-cac66ce24c59',
   'SC-HAW-2026-003', '2026-03-11',
   'a6943bd2-1f31-4682-b669-894ac2e3be5e', 'Morty (Admin)',
   'in-progress', 0,
   'Weekly full count — in progress.',
   '2026-03-11T14:00:00+11:00', '2026-03-11T14:00:00+11:00')

ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SECTION 10: STOCK COUNT ITEMS
-- expected_quantity: based on par level + deliveries - usage
-- actual_quantity: what was physically counted
-- variance = actual - expected
-- ═══════════════════════════════════════════════════════════

INSERT INTO stock_count_items (id, stock_count_id, ingredient_id, ingredient_name, expected_quantity, actual_quantity, variance, variance_value, created_at)
VALUES
  -- SC-001 (full, Feb 28)
  ('99999999-bbbb-4000-8000-000000000001', '99999999-aaaa-4000-8000-000000000001', '66666666-aaaa-4000-8000-000000000001', 'Balsamic Vinegar',           3,    3,    0,     0,     now()),
  ('99999999-bbbb-4000-8000-000000000002', '99999999-aaaa-4000-8000-000000000001', '66666666-aaaa-4000-8000-000000000002', 'Dijon Mustard',              1.5,  1,    -0.5,  -750,  now()),
  ('99999999-bbbb-4000-8000-000000000003', '99999999-aaaa-4000-8000-000000000001', '66666666-aaaa-4000-8000-000000000004', 'Lamb Mince',                 5,    4,    -1,    -1600, now()),
  ('99999999-bbbb-4000-8000-000000000004', '99999999-aaaa-4000-8000-000000000001', '66666666-aaaa-4000-8000-000000000006', 'Red Onion',                  6,    7,    1,     350,   now()),
  ('99999999-bbbb-4000-8000-000000000005', '99999999-aaaa-4000-8000-000000000001', '66666666-aaaa-4000-8000-000000000009', 'Orange Juice (Fresh)',       8,    7.5,  -0.5,  -225,  now()),
  ('99999999-bbbb-4000-8000-000000000006', '99999999-aaaa-4000-8000-000000000001', '66666666-aaaa-4000-8000-000000000005', 'Prosciutto',                 2,    1.7,  -0.3,  -1650, now()),

  -- SC-002 (cycle, Mar 7 — protein & dairy only)
  ('99999999-bbbb-4000-8000-000000000007', '99999999-aaaa-4000-8000-000000000002', '66666666-aaaa-4000-8000-000000000004', 'Lamb Mince',                 6,    5.5,  -0.5,  -800,  now()),
  ('99999999-bbbb-4000-8000-000000000008', '99999999-aaaa-4000-8000-000000000002', '66666666-aaaa-4000-8000-000000000005', 'Prosciutto',                 2,    1.8,  -0.2,  -1100, now()),
  ('99999999-bbbb-4000-8000-000000000009', '99999999-aaaa-4000-8000-000000000002', '66666666-aaaa-4000-8000-000000000007', 'Fresh Basil',                4,    4,    0,     0,     now()),

  -- SC-003 (full, Mar 11 — in progress, partial data)
  ('99999999-bbbb-4000-8000-000000000010', '99999999-aaaa-4000-8000-000000000003', '66666666-aaaa-4000-8000-000000000001', 'Balsamic Vinegar',           2,    2,    0,     0,     now()),
  ('99999999-bbbb-4000-8000-000000000011', '99999999-aaaa-4000-8000-000000000003', '66666666-aaaa-4000-8000-000000000003', 'Sriracha Sauce',             4,    4,    0,     0,     now()),
  ('99999999-bbbb-4000-8000-000000000012', '99999999-aaaa-4000-8000-000000000003', '66666666-aaaa-4000-8000-000000000009', 'Orange Juice (Fresh)',       10,   9,    -1,    -450,  now())

ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- SECTION 11: ROSTER SHIFTS — Week 2 (Mon 9 – Sun 15 Mar 2026)
-- AEDT = UTC+11: 8am AEDT = 21:00 UTC prev day
-- ═══════════════════════════════════════════════════════════

DELETE FROM roster_shifts WHERE shift_date >= '2026-03-09' AND shift_date <= '2026-03-15'
  AND org_id = '7062ac24-a551-458c-8c94-9d2c396024f9';

-- Hawthorn Week 2
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  -- Mon 9 Mar
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-09', '2026-03-08 21:00+00', '2026-03-09 04:00+00', 'manager', 'published', 30, false, 32.00, 192.00, 1, 0, 'none', 192.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-09', '2026-03-08 20:00+00', '2026-03-09 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '44e368b2-156f-42b4-8dd3-624957a20289', '2026-03-09', '2026-03-08 21:00+00', '2026-03-09 03:00+00', 'kitchen', 'published', 0,  false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f8b2973e-f1c4-45c2-91cb-85b8c8461045', '2026-03-09', '2026-03-08 21:00+00', '2026-03-09 03:00+00', 'bar',     'published', 0,  false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '8aefd6ab-09b8-4bff-8146-5d360c46ec02', '2026-03-09', '2026-03-08 21:00+00', '2026-03-09 04:00+00', 'foh',     'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000001', '2026-03-09', '2026-03-08 22:00+00', '2026-03-09 03:00+00', 'foh',     'published', 0,  false, 24.18, 120.90, 1, 0, 'none', 120.90),
  -- Tue 10 Mar
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-10', '2026-03-09 21:00+00', '2026-03-10 04:00+00', 'manager', 'published', 30, false, 32.00, 192.00, 1, 0, 'none', 192.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-10', '2026-03-09 20:00+00', '2026-03-10 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000003', '2026-03-10', '2026-03-09 21:00+00', '2026-03-10 03:00+00', 'kitchen', 'published', 0,  false, 25.00, 150.00, 1, 0, 'none', 150.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '22e8698f-5fcc-4fea-a1d7-c1d1bdc642a4', '2026-03-10', '2026-03-09 21:00+00', '2026-03-10 03:00+00', 'bar',     'published', 0,  false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '31d2ab32-1aa8-485a-8775-c17d77d7c112', '2026-03-10', '2026-03-09 21:00+00', '2026-03-10 04:00+00', 'foh',     'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '4e706e87-fc5d-4db7-a537-62b7adecbd93', '2026-03-10', '2026-03-09 22:00+00', '2026-03-10 03:00+00', 'foh',     'published', 0,  false, 24.18, 120.90, 1, 0, 'none', 120.90),
  -- Wed 11 Mar
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-11', '2026-03-10 21:00+00', '2026-03-11 04:00+00', 'manager', 'published', 30, false, 32.00, 192.00, 1, 0, 'none', 192.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-11', '2026-03-10 20:00+00', '2026-03-11 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '44e368b2-156f-42b4-8dd3-624957a20289', '2026-03-11', '2026-03-10 21:00+00', '2026-03-11 03:00+00', 'kitchen', 'published', 0,  false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000002', '2026-03-11', '2026-03-10 21:00+00', '2026-03-11 03:00+00', 'bar',     'published', 0,  false, 30.23, 181.38, 1, 0, 'none', 181.38),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '8aefd6ab-09b8-4bff-8146-5d360c46ec02', '2026-03-11', '2026-03-10 21:00+00', '2026-03-11 04:00+00', 'foh',     'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000001', '2026-03-11', '2026-03-10 22:00+00', '2026-03-11 03:00+00', 'foh',     'published', 0,  false, 24.18, 120.90, 1, 0, 'none', 120.90),
  -- Thu 12 Mar
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-12', '2026-03-11 21:00+00', '2026-03-12 04:00+00', 'manager', 'published', 30, false, 32.00, 192.00, 1, 0, 'none', 192.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-12', '2026-03-11 20:00+00', '2026-03-12 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000003', '2026-03-12', '2026-03-11 21:00+00', '2026-03-12 03:00+00', 'kitchen', 'published', 0,  false, 25.00, 150.00, 1, 0, 'none', 150.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f8b2973e-f1c4-45c2-91cb-85b8c8461045', '2026-03-12', '2026-03-11 21:00+00', '2026-03-12 03:00+00', 'bar',     'published', 0,  false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '31d2ab32-1aa8-485a-8775-c17d77d7c112', '2026-03-12', '2026-03-11 21:00+00', '2026-03-12 04:00+00', 'foh',     'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000004', '2026-03-12', '2026-03-11 22:00+00', '2026-03-12 03:00+00', 'foh',     'published', 0,  false, 24.18, 120.90, 1, 0, 'none', 120.90),
  -- Fri 13 Mar (bigger crew)
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-13', '2026-03-12 21:00+00', '2026-03-13 04:00+00', 'manager', 'published', 30, false, 32.00, 192.00, 1, 0, 'none', 192.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-13', '2026-03-12 20:00+00', '2026-03-13 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '44e368b2-156f-42b4-8dd3-624957a20289', '2026-03-13', '2026-03-12 21:00+00', '2026-03-13 04:00+00', 'kitchen', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '22e8698f-5fcc-4fea-a1d7-c1d1bdc642a4', '2026-03-13', '2026-03-12 21:00+00', '2026-03-13 03:00+00', 'bar',     'published', 0,  false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000002', '2026-03-13', '2026-03-12 21:00+00', '2026-03-13 03:00+00', 'bar',     'published', 0,  false, 30.23, 181.38, 1, 0, 'none', 181.38),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '8aefd6ab-09b8-4bff-8146-5d360c46ec02', '2026-03-13', '2026-03-12 21:00+00', '2026-03-13 04:00+00', 'foh',     'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000001', '2026-03-13', '2026-03-12 21:00+00', '2026-03-13 04:00+00', 'foh',     'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  -- Sat 14 Mar (weekend penalty 1.25x)
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-14', '2026-03-13 22:00+00', '2026-03-14 03:00+00', 'manager', 'published', 0,  false, 32.00, 160.00, 1.25, 40.00, 'saturday', 200.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-14', '2026-03-13 21:00+00', '2026-03-14 03:00+00', 'kitchen', 'published', 30, false, 29.00, 145.00, 1.25, 36.25, 'saturday', 181.25),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '44e368b2-156f-42b4-8dd3-624957a20289', '2026-03-14', '2026-03-13 22:00+00', '2026-03-14 03:00+00', 'kitchen', 'published', 0,  false, 24.18, 120.90, 1.25, 30.23, 'saturday', 151.13),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f8b2973e-f1c4-45c2-91cb-85b8c8461045', '2026-03-14', '2026-03-13 22:00+00', '2026-03-14 03:00+00', 'bar',     'published', 0,  false, 27.00, 135.00, 1.25, 33.75, 'saturday', 168.75),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '31d2ab32-1aa8-485a-8775-c17d77d7c112', '2026-03-14', '2026-03-13 22:00+00', '2026-03-14 03:00+00', 'foh',     'published', 0,  false, 24.18, 120.90, 1.25, 30.23, 'saturday', 151.13),
  -- Sun 15 Mar (public holiday / sunday penalty 1.5x)
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-15', '2026-03-14 22:00+00', '2026-03-15 03:00+00', 'manager', 'published', 0,  false, 32.00, 160.00, 1.5, 80.00,  'sunday', 240.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-15', '2026-03-14 21:00+00', '2026-03-15 03:00+00', 'kitchen', 'published', 30, false, 29.00, 145.00, 1.5, 72.50,  'sunday', 217.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000003', '2026-03-15', '2026-03-14 22:00+00', '2026-03-15 03:00+00', 'kitchen', 'published', 0,  false, 25.00, 125.00, 1.5, 62.50,  'sunday', 187.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '22e8698f-5fcc-4fea-a1d7-c1d1bdc642a4', '2026-03-15', '2026-03-14 22:00+00', '2026-03-15 03:00+00', 'bar',     'published', 0,  false, 27.00, 135.00, 1.5, 67.50,  'sunday', 202.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '8aefd6ab-09b8-4bff-8146-5d360c46ec02', '2026-03-15', '2026-03-14 22:00+00', '2026-03-15 03:00+00', 'foh',     'published', 0,  false, 24.18, 120.90, 1.5, 60.45,  'sunday', 181.35);

-- South Yarra Week 2
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  -- Mon 9 Mar SY
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000001', '2026-03-09', '2026-03-08 21:00+00', '2026-03-09 04:00+00', 'manager', 'published', 30, false, 33.00, 198.00, 1, 0, 'none', 198.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000002', '2026-03-09', '2026-03-08 20:00+00', '2026-03-09 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000003', '2026-03-09', '2026-03-08 21:00+00', '2026-03-09 03:00+00', 'kitchen', 'published', 0,  false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000008', '2026-03-09', '2026-03-08 21:00+00', '2026-03-09 03:00+00', 'bar',     'published', 0,  false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000005', '2026-03-09', '2026-03-08 21:00+00', '2026-03-09 04:00+00', 'foh',     'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000006', '2026-03-09', '2026-03-08 22:00+00', '2026-03-09 03:00+00', 'foh',     'published', 0,  false, 27.00, 135.00, 1, 0, 'none', 135.00),
  -- Fri 13 Mar SY (spot check for trends)
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000001', '2026-03-13', '2026-03-12 21:00+00', '2026-03-13 04:00+00', 'manager', 'published', 30, false, 33.00, 198.00, 1, 0, 'none', 198.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000002', '2026-03-13', '2026-03-12 20:00+00', '2026-03-13 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000004', '2026-03-13', '2026-03-12 21:00+00', '2026-03-13 03:00+00', 'kitchen', 'published', 0,  false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000009', '2026-03-13', '2026-03-12 21:00+00', '2026-03-13 03:00+00', 'bar',     'published', 0,  false, 30.23, 181.38, 1, 0, 'none', 181.38),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000007', '2026-03-13', '2026-03-12 21:00+00', '2026-03-13 04:00+00', 'foh',     'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000010', '2026-03-13', '2026-03-12 22:00+00', '2026-03-13 03:00+00', 'foh',     'published', 0,  false, 24.18, 120.90, 1, 0, 'none', 120.90),
  -- Sun 15 Mar SY (sunday penalty)
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000001', '2026-03-15', '2026-03-14 22:00+00', '2026-03-15 03:00+00', 'manager', 'published', 0,  false, 33.00, 165.00, 1.5, 82.50, 'sunday', 247.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000002', '2026-03-15', '2026-03-14 21:00+00', '2026-03-15 03:00+00', 'kitchen', 'published', 30, false, 29.00, 145.00, 1.5, 72.50, 'sunday', 217.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000005', '2026-03-15', '2026-03-14 22:00+00', '2026-03-15 03:00+00', 'foh',     'published', 0,  false, 24.18, 120.90, 1.5, 60.45, 'sunday', 181.35),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000006', '2026-03-15', '2026-03-14 22:00+00', '2026-03-15 03:00+00', 'foh',     'published', 0,  false, 27.00, 135.00, 1.5, 67.50, 'sunday', 202.50);


-- ═══════════════════════════════════════════════════════════
-- SECTION 12: ORDERS — Week 2 (Mon 9 – Sun 15 Mar 2026)
-- Amounts in CENTS. org_id added per later migration.
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  haw_vid  uuid := '894d69a2-ba06-4887-8bac-cac66ce24c59';
  sy_vid   uuid := 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c';
  oid      uuid := '7062ac24-a551-458c-8c94-9d2c396024f9';
  d        date;
  channels text[] := ARRAY['dine-in','dine-in','dine-in','dine-in','takeaway','takeaway','online','delivery'];
  paymthds text[] := ARRAY['card','card','card','card','digital_wallet','digital_wallet','cash'];
  i        int;
  cnt      int;
  target   int;
  gross    int;
  tax      int;
  disc     int;
  tip      int;
  ch       text;
  pm       text;
  hr       int;
  mn       int;
  odt      timestamptz;
BEGIN
  DELETE FROM orders WHERE notes = 'demo-seed-2026-03-11';

  FOR d IN SELECT generate_series('2026-03-09'::date, '2026-03-15'::date, '1 day') LOOP
    -- Hawthorn
    CASE extract(dow FROM d)::int
      WHEN 0 THEN target := 210000; cnt := 14;
      WHEN 6 THEN target := 230000; cnt := 15;
      ELSE        target := 185000; cnt := 12;
    END CASE;
    FOR i IN 1..cnt LOOP
      ch := channels[1 + floor(random() * array_length(channels,1))::int];
      pm := paymthds[1 + floor(random() * array_length(paymthds,1))::int];
      gross := greatest(500, ((target / cnt) + (random() * 3000 - 1500)::int) / 50 * 50);
      tax := gross * 10 / 110;
      disc := CASE WHEN random() < 0.08 THEN (gross * 0.1)::int ELSE 0 END;
      tip  := CASE WHEN random() < 0.15 THEN (200 + random() * 500)::int ELSE 0 END;
      CASE extract(dow FROM d)::int
        WHEN 0 THEN hr := 9 + floor(random()*5)::int;
        WHEN 6 THEN hr := 9 + floor(random()*5)::int;
        ELSE        hr := 8 + floor(random()*7)::int;
      END CASE;
      mn := floor(random() * 60)::int;
      odt := (d || ' ' || hr || ':' || lpad(mn::text,2,'0') || ':00')::timestamp AT TIME ZONE 'Australia/Melbourne';
      INSERT INTO orders (id, venue_id, org_id, order_number, order_datetime, channel, gross_amount, tax_amount, discount_amount, net_amount, service_charge, tip_amount, is_void, is_refund, payment_method, notes)
      VALUES (gen_random_uuid(), haw_vid, oid,
              'HAW-' || to_char(d,'YYYYMMDD') || '-' || lpad(i::text,3,'0'),
              odt, ch, gross, tax, disc, gross - disc, 0, tip, false, false, pm,
              'demo-seed-2026-03-11');
    END LOOP;

    -- South Yarra
    CASE extract(dow FROM d)::int
      WHEN 0 THEN target := 250000; cnt := 17;
      WHEN 6 THEN target := 290000; cnt := 19;
      ELSE        target := 225000; cnt := 15;
    END CASE;
    FOR i IN 1..cnt LOOP
      ch := channels[1 + floor(random() * array_length(channels,1))::int];
      pm := paymthds[1 + floor(random() * array_length(paymthds,1))::int];
      gross := greatest(500, ((target / cnt) + (random() * 4000 - 2000)::int) / 50 * 50);
      tax := gross * 10 / 110;
      disc := CASE WHEN random() < 0.08 THEN (gross * 0.1)::int ELSE 0 END;
      tip  := CASE WHEN random() < 0.2  THEN (200 + random() * 800)::int ELSE 0 END;
      CASE extract(dow FROM d)::int
        WHEN 0 THEN hr := 9 + floor(random()*5)::int;
        WHEN 6 THEN hr := 9 + floor(random()*5)::int;
        ELSE        hr := 8 + floor(random()*7)::int;
      END CASE;
      mn := floor(random() * 60)::int;
      odt := (d || ' ' || hr || ':' || lpad(mn::text,2,'0') || ':00')::timestamp AT TIME ZONE 'Australia/Melbourne';
      INSERT INTO orders (id, venue_id, org_id, order_number, order_datetime, channel, gross_amount, tax_amount, discount_amount, net_amount, service_charge, tip_amount, is_void, is_refund, payment_method, notes)
      VALUES (gen_random_uuid(), sy_vid, oid,
              'SY-' || to_char(d,'YYYYMMDD') || '-' || lpad(i::text,3,'0'),
              odt, ch, gross, tax, disc, gross - disc, 0, tip, false, false, pm,
              'demo-seed-2026-03-11');
    END LOOP;
  END LOOP;
END$$;


-- ═══════════════════════════════════════════════════════════
-- SECTION 13: INGREDIENT PRICE HISTORY
-- Track price changes (columns: id, ingredient_id, old_cost_cents,
-- new_cost_cents, changed_at, changed_by, source)
-- ═══════════════════════════════════════════════════════════

INSERT INTO ingredient_price_history (id, ingredient_id, old_cost_cents, new_cost_cents, changed_at, source)
VALUES
  -- Streaky bacon: $16 → $18 per kg (Bidfood increase)
  (gen_random_uuid(), '66666666-bbbb-4000-8000-000000000004',
   1600, 1800, '2026-02-15T09:00:00+11:00', 'manual'),

  -- Coffee beans: $32 → $35 per kg (PFD premium roast)
  (gen_random_uuid(), '66666666-bbbb-4000-8000-000000000013',
   3200, 3500, '2026-03-01T09:00:00+11:00', 'manual'),

  -- Avocado: $2 → $2.50 each (seasonal)
  (gen_random_uuid(), '66666666-bbbb-4000-8000-000000000003',
   200, 250, '2026-03-05T09:00:00+11:00', 'manual');


COMMIT;

-- ============================================================
-- SEED COMPLETE
-- Summary of additions:
--   10 shared org-level recipes with ingredient links
--   4 menu sections
--   10 Hawthorn + 8 South Yarra menu items
--   5 purchase orders (3 HAW + 2 SY) with line items
--   3 stock counts with count items (Hawthorn)
--   2nd week roster shifts (HAW full week + SY spot days)
--   2nd week sales orders (both venues, Mon 9 – Sun 15 Mar)
--   3 price history entries
-- ============================================================
