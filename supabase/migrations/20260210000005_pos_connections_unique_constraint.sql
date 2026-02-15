-- ============================================
-- Add UNIQUE constraint on pos_connections(org_id, provider)
--
-- Required for the callback upsert:
--   .upsert({...}, { onConflict: 'org_id,provider' })
-- Without this constraint, PostgREST rejects the upsert.
-- ============================================

-- Clean up any duplicate rows first (keep the most recent per org+provider)
DELETE FROM pos_connections
WHERE id NOT IN (
  SELECT DISTINCT ON (org_id, provider) id
  FROM pos_connections
  ORDER BY org_id, provider, created_at DESC
);

-- Add the unique constraint
ALTER TABLE pos_connections
  ADD CONSTRAINT pos_connections_org_id_provider_unique
  UNIQUE (org_id, provider);
