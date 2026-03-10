-- ============================================================
-- Migration: Venue Setup for Pilot (PPB Hawthorn + PPB South Yarra)
-- Date: 2026-03-08
-- Description:
--   1. Fix org name typo → "Piccolo Panini Bar"
--   2. Rename venue → "PPB Hawthorn"
--   3. Create "PPB South Yarra" venue
--   4. Seed realistic demo data for both venues
-- ============================================================

BEGIN;

-- Known IDs
-- org:              7062ac24-a551-458c-8c94-9d2c396024f9
-- venue (hawthorn): 894d69a2-ba06-4887-8bac-cac66ce24c59
-- morty user:       a6943bd2-1f31-4682-b669-894ac2e3be5e
-- morty org_member: 539683ba-91fe-43cc-bd9d-401fa3c6d753

-- ═══════════════════════════════════════════════════════════
-- TASK 1: Fix Organization & Venue Names
-- ═══════════════════════════════════════════════════════════

UPDATE organizations
SET name = 'Piccolo Panini Bar', updated_at = now()
WHERE id = '7062ac24-a551-458c-8c94-9d2c396024f9';

UPDATE venues
SET name = 'PPB Hawthorn',
    address = '123 Glenferrie Rd, Hawthorn VIC 3122',
    updated_at = now()
WHERE id = '894d69a2-ba06-4887-8bac-cac66ce24c59';

-- Create PPB South Yarra
INSERT INTO venues (id, org_id, name, is_active, address, timezone, trading_hours, venue_type)
VALUES (
  'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
  '7062ac24-a551-458c-8c94-9d2c396024f9',
  'PPB South Yarra', true,
  '45 Toorak Rd, South Yarra VIC 3141',
  'Australia/Melbourne', '{}', 'restaurant'
);

-- Morty access to South Yarra
INSERT INTO venue_access (id, org_member_id, venue_id, can_view, can_edit)
VALUES (
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  '539683ba-91fe-43cc-bd9d-401fa3c6d753',
  'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c',
  true, true
);


-- ═══════════════════════════════════════════════════════════
-- Create auth.users entries (profiles FK → auth.users)
-- These are demo-only accounts with no real login capability
-- The profiles trigger auto-creates profiles, so we use ON CONFLICT to update names
-- ═══════════════════════════════════════════════════════════

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-aaaa-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sarah.haw@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-aaaa-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben.haw@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-aaaa-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'olivia.haw@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-aaaa-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marcus.haw@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-bbbb-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'damien.sy@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-bbbb-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ruby.sy@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-bbbb-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'noah.sy@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-bbbb-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zara.sy@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-bbbb-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ethan.sy@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-bbbb-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'chloe.sy@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-bbbb-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kai.sy@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-bbbb-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'maya.sy@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-bbbb-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sam.sy@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}'),
  ('11111111-bbbb-4000-8000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jess.sy@supersolt.test', '$2a$10$demo000000000000000000000000000000000000000000000000', now(), now(), now(), '', '{"provider":"email","providers":["email"]}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT id, id, jsonb_build_object('sub', id::text, 'email', email), 'email', id::text, now(), now(), now()
FROM auth.users WHERE email LIKE '%supersolt.test'
ON CONFLICT (provider_id, provider) DO NOTHING;


-- ═══════════════════════════════════════════════════════════
-- TASK 2A: 4 Additional Hawthorn Staff (→ 12 total)
-- ═══════════════════════════════════════════════════════════

-- Profiles are auto-created by auth trigger; update names
INSERT INTO profiles (id, email, first_name, last_name) VALUES
  ('11111111-aaaa-4000-8000-000000000001', 'sarah.haw@supersolt.test', 'Sarah', 'Mitchell'),
  ('11111111-aaaa-4000-8000-000000000002', 'ben.haw@supersolt.test', 'Ben', 'Taylor'),
  ('11111111-aaaa-4000-8000-000000000003', 'olivia.haw@supersolt.test', 'Olivia', 'Kim'),
  ('11111111-aaaa-4000-8000-000000000004', 'marcus.haw@supersolt.test', 'Marcus', 'Webb')
ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email;

INSERT INTO org_members (id, org_id, user_id, role, is_active) VALUES
  ('22222222-aaaa-4000-8000-000000000001', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-aaaa-4000-8000-000000000001', 'staff', true),
  ('22222222-aaaa-4000-8000-000000000002', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-aaaa-4000-8000-000000000002', 'staff', true),
  ('22222222-aaaa-4000-8000-000000000003', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-aaaa-4000-8000-000000000003', 'staff', true),
  ('22222222-aaaa-4000-8000-000000000004', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-aaaa-4000-8000-000000000004', 'staff', true);

-- base_hourly_rate in CENTS
INSERT INTO staff (id, org_member_id, employment_type, position, base_hourly_rate, award_classification, start_date, onboarding_status) VALUES
  ('33333333-aaaa-4000-8000-000000000001', '22222222-aaaa-4000-8000-000000000001', 'casual',    'Front of House', 2418, 'Restaurant Industry Award - Level 1', '2025-08-01', 'complete'),
  ('33333333-aaaa-4000-8000-000000000002', '22222222-aaaa-4000-8000-000000000002', 'casual',    'Barista',        3023, 'Restaurant Industry Award - Level 2', '2025-09-01', 'complete'),
  ('33333333-aaaa-4000-8000-000000000003', '22222222-aaaa-4000-8000-000000000003', 'part-time', 'Kitchen Hand',   2500, 'Restaurant Industry Award - Level 1', '2025-07-01', 'complete'),
  ('33333333-aaaa-4000-8000-000000000004', '22222222-aaaa-4000-8000-000000000004', 'casual',    'Front of House', 2418, 'Restaurant Industry Award - Level 1', '2025-10-01', 'complete');

INSERT INTO venue_access (id, org_member_id, venue_id, can_view, can_edit) VALUES
  ('44444444-aaaa-4000-8000-000000000001', '22222222-aaaa-4000-8000-000000000001', '894d69a2-ba06-4887-8bac-cac66ce24c59', true, false),
  ('44444444-aaaa-4000-8000-000000000002', '22222222-aaaa-4000-8000-000000000002', '894d69a2-ba06-4887-8bac-cac66ce24c59', true, false),
  ('44444444-aaaa-4000-8000-000000000003', '22222222-aaaa-4000-8000-000000000003', '894d69a2-ba06-4887-8bac-cac66ce24c59', true, false),
  ('44444444-aaaa-4000-8000-000000000004', '22222222-aaaa-4000-8000-000000000004', '894d69a2-ba06-4887-8bac-cac66ce24c59', true, false);


-- ═══════════════════════════════════════════════════════════
-- TASK 2B: 10 South Yarra Staff
-- 1 manager, 3 kitchen, 3 FOH, 2 bar, 1 all-rounder
-- ═══════════════════════════════════════════════════════════

INSERT INTO profiles (id, email, first_name, last_name) VALUES
  ('11111111-bbbb-4000-8000-000000000001', 'damien.sy@supersolt.test',  'Damien', 'Clarke'),
  ('11111111-bbbb-4000-8000-000000000002', 'ruby.sy@supersolt.test',    'Ruby',   'Anderson'),
  ('11111111-bbbb-4000-8000-000000000003', 'noah.sy@supersolt.test',    'Noah',   'Garcia'),
  ('11111111-bbbb-4000-8000-000000000004', 'zara.sy@supersolt.test',    'Zara',   'Singh'),
  ('11111111-bbbb-4000-8000-000000000005', 'ethan.sy@supersolt.test',   'Ethan',  'Brown'),
  ('11111111-bbbb-4000-8000-000000000006', 'chloe.sy@supersolt.test',   'Chloe',  'Wilson'),
  ('11111111-bbbb-4000-8000-000000000007', 'kai.sy@supersolt.test',     'Kai',    'Tanaka'),
  ('11111111-bbbb-4000-8000-000000000008', 'maya.sy@supersolt.test',    'Maya',   'Roberts'),
  ('11111111-bbbb-4000-8000-000000000009', 'sam.sy@supersolt.test',     'Sam',    'Lee'),
  ('11111111-bbbb-4000-8000-000000000010', 'jess.sy@supersolt.test',    'Jess',   'Thompson')
ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, email = EXCLUDED.email;

INSERT INTO org_members (id, org_id, user_id, role, is_active) VALUES
  ('22222222-bbbb-4000-8000-000000000001', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-bbbb-4000-8000-000000000001', 'manager', true),
  ('22222222-bbbb-4000-8000-000000000002', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-bbbb-4000-8000-000000000002', 'staff', true),
  ('22222222-bbbb-4000-8000-000000000003', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-bbbb-4000-8000-000000000003', 'staff', true),
  ('22222222-bbbb-4000-8000-000000000004', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-bbbb-4000-8000-000000000004', 'staff', true),
  ('22222222-bbbb-4000-8000-000000000005', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-bbbb-4000-8000-000000000005', 'staff', true),
  ('22222222-bbbb-4000-8000-000000000006', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-bbbb-4000-8000-000000000006', 'staff', true),
  ('22222222-bbbb-4000-8000-000000000007', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-bbbb-4000-8000-000000000007', 'staff', true),
  ('22222222-bbbb-4000-8000-000000000008', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-bbbb-4000-8000-000000000008', 'staff', true),
  ('22222222-bbbb-4000-8000-000000000009', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-bbbb-4000-8000-000000000009', 'staff', true),
  ('22222222-bbbb-4000-8000-000000000010', '7062ac24-a551-458c-8c94-9d2c396024f9', '11111111-bbbb-4000-8000-000000000010', 'staff', true);

INSERT INTO staff (id, org_member_id, employment_type, position, base_hourly_rate, award_classification, start_date, onboarding_status) VALUES
  ('33333333-bbbb-4000-8000-000000000001', '22222222-bbbb-4000-8000-000000000001', 'full-time', 'Venue Manager',   3300, 'Restaurant Industry Award - Level 4', '2025-03-01', 'complete'),
  ('33333333-bbbb-4000-8000-000000000002', '22222222-bbbb-4000-8000-000000000002', 'full-time', 'Head Chef',       2900, 'Restaurant Industry Award - Level 3', '2025-04-01', 'complete'),
  ('33333333-bbbb-4000-8000-000000000003', '22222222-bbbb-4000-8000-000000000003', 'part-time', 'Cook',            2700, 'Restaurant Industry Award - Level 2', '2025-05-01', 'complete'),
  ('33333333-bbbb-4000-8000-000000000004', '22222222-bbbb-4000-8000-000000000004', 'casual',    'Kitchen Hand',    2418, 'Restaurant Industry Award - Level 1', '2025-06-01', 'complete'),
  ('33333333-bbbb-4000-8000-000000000005', '22222222-bbbb-4000-8000-000000000005', 'casual',    'Front of House',  2418, 'Restaurant Industry Award - Level 1', '2025-07-01', 'complete'),
  ('33333333-bbbb-4000-8000-000000000006', '22222222-bbbb-4000-8000-000000000006', 'part-time', 'Front of House',  2700, 'Restaurant Industry Award - Level 2', '2025-05-15', 'complete'),
  ('33333333-bbbb-4000-8000-000000000007', '22222222-bbbb-4000-8000-000000000007', 'casual',    'Front of House',  2418, 'Restaurant Industry Award - Level 1', '2025-08-01', 'complete'),
  ('33333333-bbbb-4000-8000-000000000008', '22222222-bbbb-4000-8000-000000000008', 'part-time', 'Barista',         2700, 'Restaurant Industry Award - Level 2', '2025-06-01', 'complete'),
  ('33333333-bbbb-4000-8000-000000000009', '22222222-bbbb-4000-8000-000000000009', 'casual',    'Barista',         3023, 'Restaurant Industry Award - Level 2', '2025-09-01', 'complete'),
  ('33333333-bbbb-4000-8000-000000000010', '22222222-bbbb-4000-8000-000000000010', 'casual',    'All-rounder',     2418, 'Restaurant Industry Award - Level 1', '2025-07-15', 'complete');

INSERT INTO venue_access (id, org_member_id, venue_id, can_view, can_edit) VALUES
  ('44444444-bbbb-4000-8000-000000000001', '22222222-bbbb-4000-8000-000000000001', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', true, true),
  ('44444444-bbbb-4000-8000-000000000002', '22222222-bbbb-4000-8000-000000000002', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', true, false),
  ('44444444-bbbb-4000-8000-000000000003', '22222222-bbbb-4000-8000-000000000003', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', true, false),
  ('44444444-bbbb-4000-8000-000000000004', '22222222-bbbb-4000-8000-000000000004', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', true, false),
  ('44444444-bbbb-4000-8000-000000000005', '22222222-bbbb-4000-8000-000000000005', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', true, false),
  ('44444444-bbbb-4000-8000-000000000006', '22222222-bbbb-4000-8000-000000000006', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', true, false),
  ('44444444-bbbb-4000-8000-000000000007', '22222222-bbbb-4000-8000-000000000007', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', true, false),
  ('44444444-bbbb-4000-8000-000000000008', '22222222-bbbb-4000-8000-000000000008', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', true, false),
  ('44444444-bbbb-4000-8000-000000000009', '22222222-bbbb-4000-8000-000000000009', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', true, false),
  ('44444444-bbbb-4000-8000-000000000010', '22222222-bbbb-4000-8000-000000000010', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', true, false);


-- ═══════════════════════════════════════════════════════════
-- TASK 2C: Additional Suppliers (org-scoped, shared)
-- Existing: Bidfood, PFD, La Manna, Floridia, Bakers Delight (5)
-- Adding 10 more → 15 total
-- ═══════════════════════════════════════════════════════════

INSERT INTO suppliers (id, organization_id, name, contact_person, email, phone, category, payment_terms, delivery_days, cutoff_time, delivery_lead_days, notes, active) VALUES
  ('55555555-aaaa-4000-8000-000000000001', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Riviana Foods',              'Lisa Park',              'orders@riviana.com.au',           '03 9555 2345', 'Pantry',     '30 days EOM', '{1,3,5}',     '14:00', 2, 'demo-seed-2026-03-08', true),
  ('55555555-aaaa-4000-8000-000000000002', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Coca-Cola Europacific',      'James Ward',             'orders@ccep.com.au',              '1800 025 123', 'Beverage',   '30 days',     '{2,5}',       '12:00', 3, 'demo-seed-2026-03-08', true),
  ('55555555-aaaa-4000-8000-000000000003', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Peters Ice Cream',           'David Chen',             'wholesale@peters.com.au',         '03 9555 6789', 'Frozen',     '14 days',     '{3}',         '10:00', 3, 'demo-seed-2026-03-08', true),
  ('55555555-aaaa-4000-8000-000000000004', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Bunzl Catering Supplies',    'Rachel Green',           'mel@bunzl.com.au',                '03 9555 3210', 'Packaging',  '30 days',     '{1,4}',       '15:00', 2, 'demo-seed-2026-03-08', true),
  ('55555555-aaaa-4000-8000-000000000005', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Jasol Cleaning',             'Mike Johnson',           'orders@jasol.com.au',             '1300 527 659', 'Cleaning',   '14 days',     '{2}',         '16:00', 3, 'demo-seed-2026-03-08', true),
  ('55555555-aaaa-4000-8000-000000000006', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Vics Premium Quality Meat',  'Victor Santoro',         'orders@vicsmeat.com.au',          '03 9555 4567', 'Meat',       '7 days',      '{1,3,5}',     '11:00', 1, 'demo-seed-2026-03-08', true),
  ('55555555-aaaa-4000-8000-000000000007', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Demcos Seafood',             'Niko Papadopoulos',      'mel@demcos.com.au',               '03 9555 8901', 'Seafood',    '7 days',      '{2,4,6}',     '08:00', 1, 'demo-seed-2026-03-08', true),
  ('55555555-aaaa-4000-8000-000000000008', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Rooftop Honey',              'Vanessa Kwiatkowski',    'wholesale@rooftophoney.com.au',   '03 9555 5432', 'Specialty',  '14 days',     '{3}',         '14:00', 5, 'demo-seed-2026-03-08', true),
  ('55555555-aaaa-4000-8000-000000000009', '7062ac24-a551-458c-8c94-9d2c396024f9', 'St Ali Coffee Roasters',     'Salvatore Malatesta',    'trade@stali.com.au',              '03 9555 7654', 'Coffee',     '14 days',     '{1,4}',       '14:00', 2, 'demo-seed-2026-03-08', true),
  ('55555555-aaaa-4000-8000-000000000010', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Spring Creek Condiments',    'Helen Zhou',             'orders@springcreek.com.au',       '03 9555 9876', 'Condiments', '30 days',     '{2,5}',       '12:00', 3, 'demo-seed-2026-03-08', true);


-- ═══════════════════════════════════════════════════════════
-- TASK 2D: Additional Hawthorn Ingredients (10 more → 30)
-- ═══════════════════════════════════════════════════════════

INSERT INTO ingredients (id, venue_id, supplier_id, supplier_name, name, category, unit, pack_size, cost_per_unit, gst_applicable, current_stock, par_level, reorder_point, notes, active, org_id) VALUES
  ('66666666-aaaa-4000-8000-000000000001', '894d69a2-ba06-4887-8bac-cac66ce24c59', '55555555-aaaa-4000-8000-000000000001', 'Riviana Foods',             'Balsamic Vinegar',          'Pantry',     'litre', 1, 800,  true,  2,  4,  1, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-aaaa-4000-8000-000000000002', '894d69a2-ba06-4887-8bac-cac66ce24c59', '55555555-aaaa-4000-8000-000000000001', 'Riviana Foods',             'Dijon Mustard',             'Condiments', 'kg',    1, 1500, true,  1,  2,  1, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-aaaa-4000-8000-000000000003', '894d69a2-ba06-4887-8bac-cac66ce24c59', '55555555-aaaa-4000-8000-000000000010', 'Spring Creek Condiments',   'Sriracha Sauce',            'Condiments', 'litre', 1, 600,  true,  3,  5,  2, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-aaaa-4000-8000-000000000004', '894d69a2-ba06-4887-8bac-cac66ce24c59', '55555555-aaaa-4000-8000-000000000006', 'Vics Premium Quality Meat', 'Lamb Mince',                'Protein',    'kg',    1, 1600, true,  5,  8,  3, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-aaaa-4000-8000-000000000005', '894d69a2-ba06-4887-8bac-cac66ce24c59', '55555555-aaaa-4000-8000-000000000006', 'Vics Premium Quality Meat', 'Prosciutto',                'Protein',    'kg',    1, 5500, true,  2,  3,  1, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-aaaa-4000-8000-000000000006', '894d69a2-ba06-4887-8bac-cac66ce24c59', '178f0bd7-5f83-4307-a4c7-e13e478aac09', 'La Manna Fresh',            'Red Onion',                 'Produce',    'kg',    1, 350,  true,  8,  10, 4, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-aaaa-4000-8000-000000000007', '894d69a2-ba06-4887-8bac-cac66ce24c59', '178f0bd7-5f83-4307-a4c7-e13e478aac09', 'La Manna Fresh',            'Fresh Basil',               'Produce',    'bunch', 1, 300,  true,  6,  10, 4, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-aaaa-4000-8000-000000000008', '894d69a2-ba06-4887-8bac-cac66ce24c59', '55555555-aaaa-4000-8000-000000000002', 'Coca-Cola Europacific',     'Sparkling Water (Case)',     'Beverage',   'case',  1, 2400, true,  3,  5,  2, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-aaaa-4000-8000-000000000009', '894d69a2-ba06-4887-8bac-cac66ce24c59', '55555555-aaaa-4000-8000-000000000002', 'Coca-Cola Europacific',     'Orange Juice (Fresh)',       'Beverage',   'litre', 1, 450,  true,  10, 15, 5, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-aaaa-4000-8000-000000000010', '894d69a2-ba06-4887-8bac-cac66ce24c59', '55555555-aaaa-4000-8000-000000000004', 'Bunzl Catering Supplies',   'Takeaway Containers (250pk)','Packaging',  'pack',  1, 4500, false, 2,  4,  1, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9');


-- ═══════════════════════════════════════════════════════════
-- TASK 2E: South Yarra Ingredients (25, mostly overlapping)
-- ═══════════════════════════════════════════════════════════

INSERT INTO ingredients (id, venue_id, supplier_id, supplier_name, name, category, unit, pack_size, cost_per_unit, gst_applicable, current_stock, par_level, reorder_point, notes, active, org_id) VALUES
  ('66666666-bbbb-4000-8000-000000000001', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', 'beeefaaa-f47a-48a4-bd46-85de440d9259', 'Bidfood Melbourne',         'Chicken Breast',        'Protein',    'kg',    1, 1200, true,  18, 25, 10, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000002', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '1c14ad89-e6b0-49f3-b8b4-61aa973a8149', 'Bakers Delight Wholesale',  'Sourdough Bread',       'Bakery',     'loaf',  1, 450,  true,  28, 35, 12, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000003', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '178f0bd7-5f83-4307-a4c7-e13e478aac09', 'La Manna Fresh',            'Avocado',               'Produce',    'each',  1, 250,  true,  40, 50, 20, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000004', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', 'beeefaaa-f47a-48a4-bd46-85de440d9259', 'Bidfood Melbourne',         'Streaky Bacon',         'Protein',    'kg',    1, 1800, true,  9,  12, 5,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000005', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '178f0bd7-5f83-4307-a4c7-e13e478aac09', 'La Manna Fresh',            'Free Range Eggs',       'Dairy',      'dozen', 1, 550,  true,  18, 25, 10, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000006', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '0fd20d00-3b2d-4eb3-8f52-a15ee4a0e83c', 'Floridia Cheese',           'Haloumi',               'Dairy',      'kg',    1, 2200, true,  6,  10, 4,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000007', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '178f0bd7-5f83-4307-a4c7-e13e478aac09', 'La Manna Fresh',            'Mixed Salad Leaves',    'Produce',    'kg',    1, 1400, true,  8,  12, 5,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000008', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '178f0bd7-5f83-4307-a4c7-e13e478aac09', 'La Manna Fresh',            'Roma Tomatoes',         'Produce',    'kg',    1, 500,  true,  15, 18, 7,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000009', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '0982205c-6847-4554-b7e9-a7111901cdc6', 'PFD Food Services',         'Smoked Salmon',         'Protein',    'kg',    1, 4500, true,  4,  6,  2,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000010', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '0fd20d00-3b2d-4eb3-8f52-a15ee4a0e83c', 'Floridia Cheese',           'Mozzarella',            'Dairy',      'kg',    1, 1600, true,  10, 12, 5,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000011', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '178f0bd7-5f83-4307-a4c7-e13e478aac09', 'La Manna Fresh',            'Mushrooms',             'Produce',    'kg',    1, 900,  true,  8,  12, 5,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000012', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '178f0bd7-5f83-4307-a4c7-e13e478aac09', 'La Manna Fresh',            'Baby Spinach',          'Produce',    'kg',    1, 1600, true,  6,  10, 4,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000013', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '0982205c-6847-4554-b7e9-a7111901cdc6', 'PFD Food Services',         'Coffee Beans (1kg)',     'Beverage',   'kg',    1, 3500, true,  8,  12, 5,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000014', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', 'beeefaaa-f47a-48a4-bd46-85de440d9259', 'Bidfood Melbourne',         'Full Cream Milk',       'Dairy',      'litre', 1, 180,  true,  35, 50, 20, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000015', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', 'beeefaaa-f47a-48a4-bd46-85de440d9259', 'Bidfood Melbourne',         'Oat Milk',              'Dairy',      'litre', 1, 350,  true,  18, 25, 10, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000016', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', 'beeefaaa-f47a-48a4-bd46-85de440d9259', 'Bidfood Melbourne',         'Olive Oil',             'Pantry',     'litre', 1, 1200, true,  4,  6,  2,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000017', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', 'beeefaaa-f47a-48a4-bd46-85de440d9259', 'Bidfood Melbourne',         'Pesto',                 'Pantry',     'kg',    1, 2800, true,  3,  5,  2,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000018', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '0fd20d00-3b2d-4eb3-8f52-a15ee4a0e83c', 'Floridia Cheese',           'Feta Cheese',           'Dairy',      'kg',    1, 1800, true,  5,  8,  3,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000019', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', 'beeefaaa-f47a-48a4-bd46-85de440d9259', 'Bidfood Melbourne',         'Hash Browns',           'Frozen',     'kg',    1, 600,  true,  12, 18, 6,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000020', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '0982205c-6847-4554-b7e9-a7111901cdc6', 'PFD Food Services',         'Hollandaise Sauce',     'Pantry',     'litre', 1, 2000, true,  4,  5,  2,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000021', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '55555555-aaaa-4000-8000-000000000006', 'Vics Premium Quality Meat', 'Wagyu Beef Patty',      'Protein',    'each',  1, 450,  true,  20, 30, 10, 'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000022', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '55555555-aaaa-4000-8000-000000000006', 'Vics Premium Quality Meat', 'Prosciutto',            'Protein',    'kg',    1, 5500, true,  2,  4,  1,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000023', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '55555555-aaaa-4000-8000-000000000008', 'Rooftop Honey',             'Raw Honey',             'Specialty',  'kg',    1, 3200, true,  2,  3,  1,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000024', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '178f0bd7-5f83-4307-a4c7-e13e478aac09', 'La Manna Fresh',            'Red Onion',             'Produce',    'kg',    1, 350,  true,  10, 12, 5,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9'),
  ('66666666-bbbb-4000-8000-000000000025', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '55555555-aaaa-4000-8000-000000000002', 'Coca-Cola Europacific',     'Sparkling Water (Case)','Beverage',   'case',  1, 2400, true,  4,  6,  2,  'demo-seed-2026-03-08', true, '7062ac24-a551-458c-8c94-9d2c396024f9');


-- ═══════════════════════════════════════════════════════════
-- TASK 2F: 2 SY-Exclusive Recipes (org already has 10 shared)
-- ═══════════════════════════════════════════════════════════

INSERT INTO recipes (id, org_id, name, description, category, status, batch_yield, cost_per_serve, gp_target_percent, version) VALUES
  ('77777777-bbbb-4000-8000-000000000001', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Wagyu Smash Burger',           'Wagyu beef patty, caramelised onion, American cheese, pickles, special sauce on brioche. PPB South Yarra exclusive.', 'mains',  'active', 1, 620, 68, 1),
  ('77777777-bbbb-4000-8000-000000000002', '7062ac24-a551-458c-8c94-9d2c396024f9', 'Prosciutto & Mozzarella Panini','Prosciutto, fresh mozzarella, roasted capsicum, rocket, balsamic on ciabatta. PPB South Yarra exclusive.',          'mains',  'active', 1, 550, 70, 1);

INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, cost, notes) VALUES
  ('88888888-bbbb-4000-8000-000000000001', '77777777-bbbb-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000021', 1,    'each', 450, NULL),
  ('88888888-bbbb-4000-8000-000000000002', '77777777-bbbb-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000024', 0.05, 'kg',   18,  'caramelised'),
  ('88888888-bbbb-4000-8000-000000000003', '77777777-bbbb-4000-8000-000000000001', '66666666-bbbb-4000-8000-000000000007', 0.03, 'kg',   42,  NULL),
  ('88888888-bbbb-4000-8000-000000000004', '77777777-bbbb-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000022', 0.05, 'kg',   275, NULL),
  ('88888888-bbbb-4000-8000-000000000005', '77777777-bbbb-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000010', 0.04, 'kg',   64,  NULL),
  ('88888888-bbbb-4000-8000-000000000006', '77777777-bbbb-4000-8000-000000000002', '66666666-bbbb-4000-8000-000000000007', 0.03, 'kg',   42,  NULL);


-- ═══════════════════════════════════════════════════════════
-- TASK 2G: Roster Shifts (Mon 2 Mar – Sun 8 Mar 2026)
-- AEDT = UTC+11: 8am AEDT=21:00 UTC prev, 3pm AEDT=04:00 UTC
-- Weekend: 9am=22:00 UTC prev, 2pm=03:00 UTC
-- ═══════════════════════════════════════════════════════════

DELETE FROM roster_shifts WHERE shift_date >= '2026-03-02' AND shift_date <= '2026-03-08';

-- Hawthorn weekdays (6 staff/day, rotating)
-- Mon
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-02', '2026-03-01 21:00+00', '2026-03-02 04:00+00', 'manager', 'published', 30, false, 32.00, 192.00, 1, 0, 'none', 192.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-02', '2026-03-01 20:00+00', '2026-03-02 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '44e368b2-156f-42b4-8dd3-624957a20289', '2026-03-02', '2026-03-01 21:00+00', '2026-03-02 03:00+00', 'kitchen', 'published', 0, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f8b2973e-f1c4-45c2-91cb-85b8c8461045', '2026-03-02', '2026-03-01 21:00+00', '2026-03-02 03:00+00', 'bar', 'published', 0, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '8aefd6ab-09b8-4bff-8146-5d360c46ec02', '2026-03-02', '2026-03-01 21:00+00', '2026-03-02 04:00+00', 'foh', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000001', '2026-03-02', '2026-03-01 22:00+00', '2026-03-02 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1, 0, 'none', 120.90);
-- Tue
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-03', '2026-03-02 21:00+00', '2026-03-03 04:00+00', 'manager', 'published', 30, false, 32.00, 192.00, 1, 0, 'none', 192.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-03', '2026-03-02 20:00+00', '2026-03-03 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000003', '2026-03-03', '2026-03-02 21:00+00', '2026-03-03 03:00+00', 'kitchen', 'published', 0, false, 25.00, 150.00, 1, 0, 'none', 150.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '22e8698f-5fcc-4fea-a1d7-c1d1bdc642a4', '2026-03-03', '2026-03-02 21:00+00', '2026-03-03 03:00+00', 'bar', 'published', 0, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '31d2ab32-1aa8-485a-8775-c17d77d7c112', '2026-03-03', '2026-03-02 21:00+00', '2026-03-03 04:00+00', 'foh', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '4e706e87-fc5d-4db7-a537-62b7adecbd93', '2026-03-03', '2026-03-02 22:00+00', '2026-03-03 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1, 0, 'none', 120.90);
-- Wed
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-04', '2026-03-03 21:00+00', '2026-03-04 04:00+00', 'manager', 'published', 30, false, 32.00, 192.00, 1, 0, 'none', 192.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-04', '2026-03-03 20:00+00', '2026-03-04 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '44e368b2-156f-42b4-8dd3-624957a20289', '2026-03-04', '2026-03-03 21:00+00', '2026-03-04 03:00+00', 'kitchen', 'published', 0, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000002', '2026-03-04', '2026-03-03 21:00+00', '2026-03-04 03:00+00', 'bar', 'published', 0, false, 30.23, 181.38, 1, 0, 'none', 181.38),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '8aefd6ab-09b8-4bff-8146-5d360c46ec02', '2026-03-04', '2026-03-03 21:00+00', '2026-03-04 04:00+00', 'foh', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000001', '2026-03-04', '2026-03-03 22:00+00', '2026-03-04 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1, 0, 'none', 120.90);
-- Thu
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-05', '2026-03-04 21:00+00', '2026-03-05 04:00+00', 'manager', 'published', 30, false, 32.00, 192.00, 1, 0, 'none', 192.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-05', '2026-03-04 20:00+00', '2026-03-05 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000003', '2026-03-05', '2026-03-04 21:00+00', '2026-03-05 03:00+00', 'kitchen', 'published', 0, false, 25.00, 150.00, 1, 0, 'none', 150.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f8b2973e-f1c4-45c2-91cb-85b8c8461045', '2026-03-05', '2026-03-04 21:00+00', '2026-03-05 03:00+00', 'bar', 'published', 0, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '31d2ab32-1aa8-485a-8775-c17d77d7c112', '2026-03-05', '2026-03-04 21:00+00', '2026-03-05 04:00+00', 'foh', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '4e706e87-fc5d-4db7-a537-62b7adecbd93', '2026-03-05', '2026-03-04 22:00+00', '2026-03-05 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1, 0, 'none', 120.90);
-- Fri (bigger crew)
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 04:00+00', 'manager', 'published', 30, false, 32.00, 192.00, 1, 0, 'none', 192.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-06', '2026-03-05 20:00+00', '2026-03-06 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '44e368b2-156f-42b4-8dd3-624957a20289', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 04:00+00', 'kitchen', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '22e8698f-5fcc-4fea-a1d7-c1d1bdc642a4', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 03:00+00', 'bar', 'published', 0, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000002', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 03:00+00', 'bar', 'published', 0, false, 30.23, 181.38, 1, 0, 'none', 181.38),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '8aefd6ab-09b8-4bff-8146-5d360c46ec02', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 04:00+00', 'foh', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000001', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 04:00+00', 'foh', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08);
-- Sat (weekend penalties, shorter shift 9-2)
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-07', '2026-03-06 22:00+00', '2026-03-07 03:00+00', 'manager', 'published', 0, false, 32.00, 160.00, 1.25, 40.00, 'saturday', 200.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-07', '2026-03-06 21:00+00', '2026-03-07 03:00+00', 'kitchen', 'published', 30, false, 29.00, 145.00, 1.25, 36.25, 'saturday', 181.25),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '44e368b2-156f-42b4-8dd3-624957a20289', '2026-03-07', '2026-03-06 22:00+00', '2026-03-07 03:00+00', 'kitchen', 'published', 0, false, 24.18, 120.90, 1.25, 30.23, 'saturday', 151.13),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f8b2973e-f1c4-45c2-91cb-85b8c8461045', '2026-03-07', '2026-03-06 22:00+00', '2026-03-07 03:00+00', 'bar', 'published', 0, false, 27.00, 135.00, 1.25, 33.75, 'saturday', 168.75),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '31d2ab32-1aa8-485a-8775-c17d77d7c112', '2026-03-07', '2026-03-06 22:00+00', '2026-03-07 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1.25, 30.23, 'saturday', 151.13),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '4e706e87-fc5d-4db7-a537-62b7adecbd93', '2026-03-07', '2026-03-06 22:00+00', '2026-03-07 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1.25, 30.23, 'saturday', 151.13);
-- Sun
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'f0212cb9-1680-4c07-bd60-fc3791fb9cbd', '2026-03-08', '2026-03-07 22:00+00', '2026-03-08 03:00+00', 'manager', 'published', 0, false, 32.00, 160.00, 1.5, 80.00, 'sunday', 240.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', 'a87f13fb-0a0a-4bb6-b0bb-d7b1b6f8f55e', '2026-03-08', '2026-03-07 21:00+00', '2026-03-08 03:00+00', 'kitchen', 'published', 30, false, 29.00, 145.00, 1.5, 72.50, 'sunday', 217.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000003', '2026-03-08', '2026-03-07 22:00+00', '2026-03-08 03:00+00', 'kitchen', 'published', 0, false, 25.00, 125.00, 1.5, 62.50, 'sunday', 187.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '22e8698f-5fcc-4fea-a1d7-c1d1bdc642a4', '2026-03-08', '2026-03-07 22:00+00', '2026-03-08 03:00+00', 'bar', 'published', 0, false, 27.00, 135.00, 1.5, 67.50, 'sunday', 202.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '8aefd6ab-09b8-4bff-8146-5d360c46ec02', '2026-03-08', '2026-03-07 22:00+00', '2026-03-08 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1.5, 60.45, 'sunday', 181.35),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', '894d69a2-ba06-4887-8bac-cac66ce24c59', '33333333-aaaa-4000-8000-000000000001', '2026-03-08', '2026-03-07 22:00+00', '2026-03-08 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1.5, 60.45, 'sunday', 181.35);

-- South Yarra weekdays
-- Mon SY
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000001', '2026-03-02', '2026-03-01 21:00+00', '2026-03-02 04:00+00', 'manager', 'published', 30, false, 33.00, 198.00, 1, 0, 'none', 198.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000002', '2026-03-02', '2026-03-01 20:00+00', '2026-03-02 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000003', '2026-03-02', '2026-03-01 21:00+00', '2026-03-02 03:00+00', 'kitchen', 'published', 0, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000008', '2026-03-02', '2026-03-01 21:00+00', '2026-03-02 03:00+00', 'bar', 'published', 0, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000005', '2026-03-02', '2026-03-01 21:00+00', '2026-03-02 04:00+00', 'foh', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000006', '2026-03-02', '2026-03-01 22:00+00', '2026-03-02 03:00+00', 'foh', 'published', 0, false, 27.00, 135.00, 1, 0, 'none', 135.00);
-- Tue SY
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000001', '2026-03-03', '2026-03-02 21:00+00', '2026-03-03 04:00+00', 'manager', 'published', 30, false, 33.00, 198.00, 1, 0, 'none', 198.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000002', '2026-03-03', '2026-03-02 20:00+00', '2026-03-03 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000004', '2026-03-03', '2026-03-02 21:00+00', '2026-03-03 03:00+00', 'kitchen', 'published', 0, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000009', '2026-03-03', '2026-03-02 21:00+00', '2026-03-03 03:00+00', 'bar', 'published', 0, false, 30.23, 181.38, 1, 0, 'none', 181.38),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000007', '2026-03-03', '2026-03-02 21:00+00', '2026-03-03 04:00+00', 'foh', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000010', '2026-03-03', '2026-03-02 22:00+00', '2026-03-03 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1, 0, 'none', 120.90);
-- Wed SY
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000001', '2026-03-04', '2026-03-03 21:00+00', '2026-03-04 04:00+00', 'manager', 'published', 30, false, 33.00, 198.00, 1, 0, 'none', 198.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000002', '2026-03-04', '2026-03-03 20:00+00', '2026-03-04 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000003', '2026-03-04', '2026-03-03 21:00+00', '2026-03-04 03:00+00', 'kitchen', 'published', 0, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000008', '2026-03-04', '2026-03-03 21:00+00', '2026-03-04 03:00+00', 'bar', 'published', 0, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000006', '2026-03-04', '2026-03-03 21:00+00', '2026-03-04 04:00+00', 'foh', 'published', 30, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000005', '2026-03-04', '2026-03-03 22:00+00', '2026-03-04 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1, 0, 'none', 120.90);
-- Thu SY
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000001', '2026-03-05', '2026-03-04 21:00+00', '2026-03-05 04:00+00', 'manager', 'published', 30, false, 33.00, 198.00, 1, 0, 'none', 198.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000002', '2026-03-05', '2026-03-04 20:00+00', '2026-03-05 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000004', '2026-03-05', '2026-03-04 21:00+00', '2026-03-05 03:00+00', 'kitchen', 'published', 0, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000009', '2026-03-05', '2026-03-04 21:00+00', '2026-03-05 03:00+00', 'bar', 'published', 0, false, 30.23, 181.38, 1, 0, 'none', 181.38),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000007', '2026-03-05', '2026-03-04 21:00+00', '2026-03-05 04:00+00', 'foh', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000010', '2026-03-05', '2026-03-04 22:00+00', '2026-03-05 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1, 0, 'none', 120.90);
-- Fri SY (bigger crew)
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000001', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 04:00+00', 'manager', 'published', 30, false, 33.00, 198.00, 1, 0, 'none', 198.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000002', '2026-03-06', '2026-03-05 20:00+00', '2026-03-06 04:00+00', 'kitchen', 'published', 30, false, 29.00, 203.00, 1, 0, 'none', 203.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000003', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 04:00+00', 'kitchen', 'published', 30, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000004', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 03:00+00', 'kitchen', 'published', 0, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000008', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 03:00+00', 'bar', 'published', 0, false, 27.00, 162.00, 1, 0, 'none', 162.00),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000009', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 03:00+00', 'bar', 'published', 0, false, 30.23, 181.38, 1, 0, 'none', 181.38),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000005', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 04:00+00', 'foh', 'published', 30, false, 24.18, 145.08, 1, 0, 'none', 145.08),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000006', '2026-03-06', '2026-03-05 21:00+00', '2026-03-06 04:00+00', 'foh', 'published', 30, false, 27.00, 162.00, 1, 0, 'none', 162.00);
-- Sat SY
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000001', '2026-03-07', '2026-03-06 22:00+00', '2026-03-07 03:00+00', 'manager', 'published', 0, false, 33.00, 165.00, 1.25, 41.25, 'saturday', 206.25),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000002', '2026-03-07', '2026-03-06 21:00+00', '2026-03-07 03:00+00', 'kitchen', 'published', 30, false, 29.00, 145.00, 1.25, 36.25, 'saturday', 181.25),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000004', '2026-03-07', '2026-03-06 22:00+00', '2026-03-07 03:00+00', 'kitchen', 'published', 0, false, 24.18, 120.90, 1.25, 30.23, 'saturday', 151.13),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000009', '2026-03-07', '2026-03-06 22:00+00', '2026-03-07 03:00+00', 'bar', 'published', 0, false, 30.23, 151.15, 1.25, 37.79, 'saturday', 188.94),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000007', '2026-03-07', '2026-03-06 22:00+00', '2026-03-07 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1.25, 30.23, 'saturday', 151.13),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000010', '2026-03-07', '2026-03-06 22:00+00', '2026-03-07 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1.25, 30.23, 'saturday', 151.13);
-- Sun SY
INSERT INTO roster_shifts (id, org_id, venue_id, staff_id, shift_date, start_time, end_time, position, status, break_duration_mins, is_open_shift, hourly_rate, base_cost, penalty_rate, penalty_cost, penalty_type, estimated_cost) VALUES
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000001', '2026-03-08', '2026-03-07 22:00+00', '2026-03-08 03:00+00', 'manager', 'published', 0, false, 33.00, 165.00, 1.5, 82.50, 'sunday', 247.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000002', '2026-03-08', '2026-03-07 21:00+00', '2026-03-08 03:00+00', 'kitchen', 'published', 30, false, 29.00, 145.00, 1.5, 72.50, 'sunday', 217.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000003', '2026-03-08', '2026-03-07 22:00+00', '2026-03-08 03:00+00', 'kitchen', 'published', 0, false, 27.00, 135.00, 1.5, 67.50, 'sunday', 202.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000008', '2026-03-08', '2026-03-07 22:00+00', '2026-03-08 03:00+00', 'bar', 'published', 0, false, 27.00, 135.00, 1.5, 67.50, 'sunday', 202.50),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000005', '2026-03-08', '2026-03-07 22:00+00', '2026-03-08 03:00+00', 'foh', 'published', 0, false, 24.18, 120.90, 1.5, 60.45, 'sunday', 181.35),
  (gen_random_uuid(), '7062ac24-a551-458c-8c94-9d2c396024f9', 'b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c', '33333333-bbbb-4000-8000-000000000006', '2026-03-08', '2026-03-07 22:00+00', '2026-03-08 03:00+00', 'foh', 'published', 0, false, 27.00, 135.00, 1.5, 67.50, 'sunday', 202.50);


-- ═══════════════════════════════════════════════════════════
-- TASK 2H: Mock Sales/Orders (Mon 2 – Sun 8 Mar)
-- Hawthorn avg $1,800/day, South Yarra avg $2,200/day
-- Amounts in cents. Random mix of channels + payment methods.
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
  DELETE FROM orders WHERE notes = 'demo-seed-2026-03-08';

  FOR d IN SELECT generate_series('2026-03-02'::date, '2026-03-08'::date, '1 day') LOOP
    -- Hawthorn
    CASE extract(dow FROM d)::int
      WHEN 0 THEN target := 200000; cnt := 13;
      WHEN 6 THEN target := 220000; cnt := 14;
      ELSE        target := 180000; cnt := 12;
    END CASE;
    FOR i IN 1..cnt LOOP
      ch := channels[1 + floor(random() * array_length(channels,1))::int];
      pm := paymthds[1 + floor(random() * array_length(paymthds,1))::int];
      gross := greatest(500, ((target / cnt) + (random() * 3000 - 1500)::int) / 50 * 50);
      tax := gross * 10 / 110;
      disc := CASE WHEN random() < 0.08 THEN (gross * 0.1)::int ELSE 0 END;
      tip := CASE WHEN random() < 0.15 THEN (200 + random() * 500)::int ELSE 0 END;
      CASE extract(dow FROM d)::int WHEN 0 THEN hr := 9 + floor(random()*5)::int; WHEN 6 THEN hr := 9 + floor(random()*5)::int; ELSE hr := 8 + floor(random()*7)::int; END CASE;
      mn := floor(random() * 60)::int;
      odt := (d || ' ' || hr || ':' || lpad(mn::text,2,'0') || ':00')::timestamp AT TIME ZONE 'Australia/Melbourne';
      INSERT INTO orders (id, venue_id, org_id, order_number, order_datetime, channel, gross_amount, tax_amount, discount_amount, net_amount, service_charge, tip_amount, is_void, is_refund, payment_method, notes)
      VALUES (gen_random_uuid(), haw_vid, oid, 'HAW-' || to_char(d,'YYYYMMDD') || '-' || lpad(i::text,3,'0'), odt, ch, gross, tax, disc, gross - disc, 0, tip, false, false, pm, 'demo-seed-2026-03-08');
    END LOOP;

    -- South Yarra
    CASE extract(dow FROM d)::int
      WHEN 0 THEN target := 240000; cnt := 16;
      WHEN 6 THEN target := 280000; cnt := 18;
      ELSE        target := 220000; cnt := 15;
    END CASE;
    FOR i IN 1..cnt LOOP
      ch := channels[1 + floor(random() * array_length(channels,1))::int];
      pm := paymthds[1 + floor(random() * array_length(paymthds,1))::int];
      gross := greatest(500, ((target / cnt) + (random() * 4000 - 2000)::int) / 50 * 50);
      tax := gross * 10 / 110;
      disc := CASE WHEN random() < 0.08 THEN (gross * 0.1)::int ELSE 0 END;
      tip := CASE WHEN random() < 0.2 THEN (200 + random() * 800)::int ELSE 0 END;
      CASE extract(dow FROM d)::int WHEN 0 THEN hr := 9 + floor(random()*5)::int; WHEN 6 THEN hr := 9 + floor(random()*5)::int; ELSE hr := 8 + floor(random()*7)::int; END CASE;
      mn := floor(random() * 60)::int;
      odt := (d || ' ' || hr || ':' || lpad(mn::text,2,'0') || ':00')::timestamp AT TIME ZONE 'Australia/Melbourne';
      INSERT INTO orders (id, venue_id, org_id, order_number, order_datetime, channel, gross_amount, tax_amount, discount_amount, net_amount, service_charge, tip_amount, is_void, is_refund, payment_method, notes)
      VALUES (gen_random_uuid(), sy_vid, oid, 'SY-' || to_char(d,'YYYYMMDD') || '-' || lpad(i::text,3,'0'), odt, ch, gross, tax, disc, gross - disc, 0, tip, false, false, pm, 'demo-seed-2026-03-08');
    END LOOP;
  END LOOP;
END$$;


COMMIT;
