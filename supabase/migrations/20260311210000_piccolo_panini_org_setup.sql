-- ============================================================
-- SuperSolt Org Setup Script — Piccolo Panini Bar Pilot
-- Run against: vcfmouckydhsmvfoykms (staging)
--
-- Creates two real organisations for the Piccolo Panini Bar
-- pilot deployment. Safe to re-run — all inserts use
-- ON CONFLICT DO NOTHING or ON CONFLICT DO UPDATE.
--
-- Existing context (from 20260308000001_venue_setup_and_seed.sql):
--   Org:               7062ac24-a551-458c-8c94-9d2c396024f9  "Piccolo Panini Bar"
--   Venue (Hawthorn):  894d69a2-ba06-4887-8bac-cac66ce24c59  "PPB Hawthorn"
--   Venue (SY):        b5e7c3a1-2d4f-4e8b-9a1c-6f3d2e8b4a7c  "PPB South Yarra"
--   Morty user:        a6943bd2-1f31-4682-b669-894ac2e3be5e
--   Morty org_member:  539683ba-91fe-43cc-bd9d-401fa3c6d753
--
-- The existing setup uses a single org with two venues.
-- This script updates the org name for Hawthorn and creates a
-- separate org for South Yarra, enabling independent management.
-- ============================================================

BEGIN;

-- ── Org 1: Piccolo Panini Bar Hawthorn ───────────────────────────
-- Uses the existing org (7062ac24...) — rename it to be venue-specific.
-- Keep org_id as-is; the venue (894d69a2...) stays attached.

UPDATE organizations
SET name = 'Piccolo Panini Bar Hawthorn',
    updated_at = now()
WHERE id = '7062ac24-a551-458c-8c94-9d2c396024f9';

-- Update the venue name to be explicit
UPDATE venues
SET name = 'Piccolo Panini Bar — Hawthorn',
    updated_at = now()
WHERE id = '894d69a2-ba06-4887-8bac-cac66ce24c59';

-- ── Org 2: Piccolo Panini Bar South Yarra ────────────────────────
-- Create a new standalone org for South Yarra.
-- Uses a stable UUID derived from the venue ID pattern.

INSERT INTO organizations (id, name, created_at, updated_at)
VALUES (
  'c4f8a2e1-3b5d-4f9c-8e2a-7d6f1e4b3a8c',
  'Piccolo Panini Bar South Yarra',
  now(), now()
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      updated_at = now();

-- Create a venue for the South Yarra org
-- (The existing PPB South Yarra venue stays under Org 1 for now —
--  this new venue entry is for the standalone Org 2)
INSERT INTO venues (id, org_id, name, is_active, address, timezone, trading_hours, venue_type, created_at, updated_at)
VALUES (
  'e7d2b4f8-1a3c-4e6d-9b5a-2f8e1c4d7a9b',
  'c4f8a2e1-3b5d-4f9c-8e2a-7d6f1e4b3a8c',
  'Piccolo Panini Bar — South Yarra',
  true,
  '45 Toorak Rd, South Yarra VIC 3141',
  'Australia/Melbourne',
  '{"mon":{"open":"07:00","close":"16:00"},"tue":{"open":"07:00","close":"16:00"},"wed":{"open":"07:00","close":"16:00"},"thu":{"open":"07:00","close":"16:00"},"fri":{"open":"07:00","close":"16:00"},"sat":{"open":"08:00","close":"15:00"},"sun":{"open":"08:00","close":"15:00"}}',
  'cafe',
  now(), now()
)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      address = EXCLUDED.address,
      updated_at = now();

-- ── Add Morty as admin of the new South Yarra org ────────────────
INSERT INTO org_members (id, org_id, user_id, role, created_at, updated_at)
VALUES (
  'd9e3c5a7-2b4f-4d8e-a1c6-3f7b2e5d8a0c',
  'c4f8a2e1-3b5d-4f9c-8e2a-7d6f1e4b3a8c',
  'a6943bd2-1f31-4682-b669-894ac2e3be5e',
  'admin',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- Grant Morty venue access for South Yarra org
INSERT INTO venue_access (id, org_member_id, venue_id, can_view, can_edit)
VALUES (
  'f1b4d6e8-3a5c-4f7d-b2e8-4a1c6d9e2f5b',
  'd9e3c5a7-2b4f-4d8e-a1c6-3f7b2e5d8a0c',
  'e7d2b4f8-1a3c-4e6d-9b5a-2f8e1c4d7a9b',
  true, true
)
ON CONFLICT (id) DO NOTHING;

-- ── Verify: check both orgs exist ───────────────────────────────
DO $$
DECLARE
  org1_name TEXT;
  org2_name TEXT;
BEGIN
  SELECT name INTO org1_name FROM organizations WHERE id = '7062ac24-a551-458c-8c94-9d2c396024f9';
  SELECT name INTO org2_name FROM organizations WHERE id = 'c4f8a2e1-3b5d-4f9c-8e2a-7d6f1e4b3a8c';

  IF org1_name IS NULL THEN
    RAISE EXCEPTION 'Org 1 (Hawthorn) not found';
  END IF;
  IF org2_name IS NULL THEN
    RAISE EXCEPTION 'Org 2 (South Yarra) not found';
  END IF;

  RAISE NOTICE 'Org 1: % (%)', org1_name, '7062ac24-a551-458c-8c94-9d2c396024f9';
  RAISE NOTICE 'Org 2: % (%)', org2_name, 'c4f8a2e1-3b5d-4f9c-8e2a-7d6f1e4b3a8c';
  RAISE NOTICE 'Setup complete — 2 Piccolo Panini Bar organisations ready';
END $$;

-- ── RLS cross-org leak test ──────────────────────────────────────
-- Verify that a user with only Org 1 access cannot see Org 2 data.
-- Run as a specific user in psql:
--   SET ROLE <morty_user>;
--   SELECT * FROM organizations;   -- should return both (Morty has access to both)
--   SET ROLE <other_user_id>;
--   SELECT * FROM organizations;   -- should return ONLY orgs they belong to
--
-- The get_user_org_ids() function returns only orgs where the user
-- has an org_members row — RLS on organizations filters accordingly.

COMMIT;
