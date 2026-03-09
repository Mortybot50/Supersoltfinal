-- ============================================================
-- Repair migration: apply RLS policies that failed in 20260309000002
-- due to unnest(uuid[]) not being supported. Uses = ANY() instead.
-- Safe to re-run: all CREATE POLICY use DROP IF EXISTS first.
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- Storage bucket (idempotent)
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'invoices',
    'invoices',
    false,
    20971520,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Storage RLS
DROP POLICY IF EXISTS "invoices_storage_select" ON storage.objects;
CREATE POLICY "invoices_storage_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM organizations
      WHERE id = ANY(get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "invoices_storage_insert" ON storage.objects;
CREATE POLICY "invoices_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM organizations
      WHERE id = ANY(get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "invoices_storage_delete" ON storage.objects;
CREATE POLICY "invoices_storage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM organizations
      WHERE id = ANY(get_user_org_ids())
    )
  );

-- ═══════════════════════════════════════════════════════════
-- RLS policies for invoices (re-create with ANY)
-- ═══════════════════════════════════════════════════════════

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (org_id = ANY(get_user_org_ids()));

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (org_id = ANY(get_user_org_ids()));

DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices
  FOR DELETE USING (org_id = ANY(get_user_org_ids()));

-- ═══════════════════════════════════════════════════════════
-- RLS policies for invoice_line_items
-- ═══════════════════════════════════════════════════════════

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_line_items_select" ON invoice_line_items;
CREATE POLICY "invoice_line_items_select" ON invoice_line_items
  FOR SELECT USING (
    invoice_id IN (SELECT id FROM invoices WHERE org_id = ANY(get_user_org_ids()))
  );

DROP POLICY IF EXISTS "invoice_line_items_insert" ON invoice_line_items;
CREATE POLICY "invoice_line_items_insert" ON invoice_line_items
  FOR INSERT WITH CHECK (
    invoice_id IN (SELECT id FROM invoices WHERE org_id = ANY(get_user_org_ids()))
  );

DROP POLICY IF EXISTS "invoice_line_items_update" ON invoice_line_items;
CREATE POLICY "invoice_line_items_update" ON invoice_line_items
  FOR UPDATE USING (
    invoice_id IN (SELECT id FROM invoices WHERE org_id = ANY(get_user_org_ids()))
  );

DROP POLICY IF EXISTS "invoice_line_items_delete" ON invoice_line_items;
CREATE POLICY "invoice_line_items_delete" ON invoice_line_items
  FOR DELETE USING (
    invoice_id IN (SELECT id FROM invoices WHERE org_id = ANY(get_user_org_ids()))
  );

-- ═══════════════════════════════════════════════════════════
-- RLS policies for reconciliation_logs
-- ═══════════════════════════════════════════════════════════

ALTER TABLE reconciliation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reconciliation_logs_select" ON reconciliation_logs;
CREATE POLICY "reconciliation_logs_select" ON reconciliation_logs
  FOR SELECT USING (
    venue_id IN (SELECT v.id FROM venues v WHERE v.org_id = ANY(get_user_org_ids()))
  );

DROP POLICY IF EXISTS "reconciliation_logs_insert" ON reconciliation_logs;
CREATE POLICY "reconciliation_logs_insert" ON reconciliation_logs
  FOR INSERT WITH CHECK (
    venue_id IN (SELECT v.id FROM venues v WHERE v.org_id = ANY(get_user_org_ids()))
  );

DROP POLICY IF EXISTS "reconciliation_logs_update" ON reconciliation_logs;
CREATE POLICY "reconciliation_logs_update" ON reconciliation_logs
  FOR UPDATE USING (
    venue_id IN (SELECT v.id FROM venues v WHERE v.org_id = ANY(get_user_org_ids()))
  );

DROP POLICY IF EXISTS "reconciliation_logs_delete" ON reconciliation_logs;
CREATE POLICY "reconciliation_logs_delete" ON reconciliation_logs
  FOR DELETE USING (
    venue_id IN (SELECT v.id FROM venues v WHERE v.org_id = ANY(get_user_org_ids()))
  );

-- ═══════════════════════════════════════════════════════════
-- RLS policies for reconciliation_line_items
-- ═══════════════════════════════════════════════════════════

ALTER TABLE reconciliation_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reconciliation_line_items_select" ON reconciliation_line_items;
CREATE POLICY "reconciliation_line_items_select" ON reconciliation_line_items
  FOR SELECT USING (
    reconciliation_id IN (
      SELECT r.id FROM reconciliation_logs r
      JOIN venues v ON v.id = r.venue_id
      WHERE v.org_id = ANY(get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "reconciliation_line_items_insert" ON reconciliation_line_items;
CREATE POLICY "reconciliation_line_items_insert" ON reconciliation_line_items
  FOR INSERT WITH CHECK (
    reconciliation_id IN (
      SELECT r.id FROM reconciliation_logs r
      JOIN venues v ON v.id = r.venue_id
      WHERE v.org_id = ANY(get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "reconciliation_line_items_update" ON reconciliation_line_items;
CREATE POLICY "reconciliation_line_items_update" ON reconciliation_line_items
  FOR UPDATE USING (
    reconciliation_id IN (
      SELECT r.id FROM reconciliation_logs r
      JOIN venues v ON v.id = r.venue_id
      WHERE v.org_id = ANY(get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "reconciliation_line_items_delete" ON reconciliation_line_items;
CREATE POLICY "reconciliation_line_items_delete" ON reconciliation_line_items
  FOR DELETE USING (
    reconciliation_id IN (
      SELECT r.id FROM reconciliation_logs r
      JOIN venues v ON v.id = r.venue_id
      WHERE v.org_id = ANY(get_user_org_ids())
    )
  );
