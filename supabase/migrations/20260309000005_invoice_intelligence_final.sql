-- ============================================================
-- Invoice Intelligence System (clean single migration)
-- Creates tables, indexes, triggers, storage bucket, RLS policies
-- Uses IN (SELECT get_user_org_ids()) pattern throughout
-- ============================================================

-- 1. invoices
CREATE TABLE IF NOT EXISTS invoices (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id             uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  supplier_id          uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  source               text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'email')),
  original_file_url    text,
  original_filename    text,
  invoice_number       text,
  invoice_date         date,
  due_date             date,
  subtotal             numeric(12,2),
  tax_amount           numeric(12,2),
  total_amount         numeric(12,2),
  currency             text NOT NULL DEFAULT 'AUD',
  document_type        text NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('invoice', 'credit_note', 'statement')),
  status               text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'confirmed', 'disputed', 'duplicate')),
  matched_po_id        uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  sender_email         text,
  processing_metadata  jsonb,
  confirmed_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  confirmed_at         timestamptz,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_org_id_idx ON invoices(org_id);
CREATE INDEX IF NOT EXISTS invoices_venue_id_idx ON invoices(venue_id);
CREATE INDEX IF NOT EXISTS invoices_supplier_id_idx ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_invoice_date_idx ON invoices(invoice_date DESC);

-- 2. invoice_line_items
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id             uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  ingredient_id          uuid REFERENCES ingredients(id) ON DELETE SET NULL,
  raw_description        text NOT NULL,
  extracted_quantity     numeric(12,4),
  extracted_unit         text,
  extracted_unit_price   numeric(12,4),
  extracted_line_total   numeric(12,2),
  extracted_tax          numeric(12,2),
  extracted_discount     numeric(12,2),
  confidence_score       numeric(4,3) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  match_status           text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('auto_matched', 'manual_matched', 'new_ingredient', 'unmatched')),
  confirmed_quantity     numeric(12,4),
  confirmed_unit_price   numeric(12,4),
  variance_notes         text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_line_items_invoice_id_idx ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_line_items_ingredient_id_idx ON invoice_line_items(ingredient_id);

-- 3. reconciliation_logs
CREATE TABLE IF NOT EXISTS reconciliation_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  purchase_order_id     uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  venue_id              uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  reconciled_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reconciled_at         timestamptz NOT NULL DEFAULT now(),
  total_expected_value  numeric(12,2),
  total_received_value  numeric(12,2),
  total_variance        numeric(12,2),
  status                text NOT NULL DEFAULT 'fully_received' CHECK (status IN ('fully_received', 'partial', 'disputed')),
  notes                 text
);

CREATE INDEX IF NOT EXISTS reconciliation_logs_invoice_id_idx ON reconciliation_logs(invoice_id);
CREATE INDEX IF NOT EXISTS reconciliation_logs_venue_id_idx ON reconciliation_logs(venue_id);
CREATE INDEX IF NOT EXISTS reconciliation_logs_po_id_idx ON reconciliation_logs(purchase_order_id);

-- 4. reconciliation_line_items
CREATE TABLE IF NOT EXISTS reconciliation_line_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id       uuid NOT NULL REFERENCES reconciliation_logs(id) ON DELETE CASCADE,
  invoice_line_item_id    uuid REFERENCES invoice_line_items(id) ON DELETE SET NULL,
  po_line_item_id         uuid REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  ingredient_id           uuid REFERENCES ingredients(id) ON DELETE SET NULL,
  expected_quantity       numeric(12,4),
  received_quantity       numeric(12,4),
  expected_unit_price     numeric(12,4),
  actual_unit_price       numeric(12,4),
  quantity_variance       numeric(12,4),
  price_variance          numeric(12,4),
  status                  text NOT NULL DEFAULT 'received_full' CHECK (status IN ('received_full', 'received_partial', 'not_received', 'unexpected')),
  notes                   text
);

CREATE INDEX IF NOT EXISTS recon_line_items_recon_id_idx ON reconciliation_line_items(reconciliation_id);
CREATE INDEX IF NOT EXISTS recon_line_items_ingredient_id_idx ON reconciliation_line_items(ingredient_id);

-- 5. Add invoice_email_domains to suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invoice_email_domains text[];

-- 6. updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Storage bucket
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('invoices', 'invoices', false, 20971520,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Storage RLS
DROP POLICY IF EXISTS "invoices_storage_select" ON storage.objects;
CREATE POLICY "invoices_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id IN (SELECT get_user_org_ids())
  ));

DROP POLICY IF EXISTS "invoices_storage_insert" ON storage.objects;
CREATE POLICY "invoices_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices' AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id IN (SELECT get_user_org_ids())
  ));

DROP POLICY IF EXISTS "invoices_storage_delete" ON storage.objects;
CREATE POLICY "invoices_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM organizations WHERE id IN (SELECT get_user_org_ids())
  ));

-- 8. Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_line_items ENABLE ROW LEVEL SECURITY;

-- 9. invoices RLS
DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  USING (org_id IN (SELECT get_user_org_ids()));
DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  WITH CHECK (org_id IN (SELECT get_user_org_ids()));
DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  USING (org_id IN (SELECT get_user_org_ids()));
DROP POLICY IF EXISTS "invoices_delete" ON invoices;
CREATE POLICY "invoices_delete" ON invoices FOR DELETE
  USING (org_id IN (SELECT get_user_org_ids()));

-- 10. invoice_line_items RLS
DROP POLICY IF EXISTS "invoice_line_items_select" ON invoice_line_items;
CREATE POLICY "invoice_line_items_select" ON invoice_line_items FOR SELECT
  USING (invoice_id IN (SELECT id FROM invoices WHERE org_id IN (SELECT get_user_org_ids())));
DROP POLICY IF EXISTS "invoice_line_items_insert" ON invoice_line_items;
CREATE POLICY "invoice_line_items_insert" ON invoice_line_items FOR INSERT
  WITH CHECK (invoice_id IN (SELECT id FROM invoices WHERE org_id IN (SELECT get_user_org_ids())));
DROP POLICY IF EXISTS "invoice_line_items_update" ON invoice_line_items;
CREATE POLICY "invoice_line_items_update" ON invoice_line_items FOR UPDATE
  USING (invoice_id IN (SELECT id FROM invoices WHERE org_id IN (SELECT get_user_org_ids())));
DROP POLICY IF EXISTS "invoice_line_items_delete" ON invoice_line_items;
CREATE POLICY "invoice_line_items_delete" ON invoice_line_items FOR DELETE
  USING (invoice_id IN (SELECT id FROM invoices WHERE org_id IN (SELECT get_user_org_ids())));

-- 11. reconciliation_logs RLS
DROP POLICY IF EXISTS "reconciliation_logs_select" ON reconciliation_logs;
CREATE POLICY "reconciliation_logs_select" ON reconciliation_logs FOR SELECT
  USING (venue_id IN (SELECT v.id FROM venues v WHERE v.org_id IN (SELECT get_user_org_ids())));
DROP POLICY IF EXISTS "reconciliation_logs_insert" ON reconciliation_logs;
CREATE POLICY "reconciliation_logs_insert" ON reconciliation_logs FOR INSERT
  WITH CHECK (venue_id IN (SELECT v.id FROM venues v WHERE v.org_id IN (SELECT get_user_org_ids())));
DROP POLICY IF EXISTS "reconciliation_logs_update" ON reconciliation_logs;
CREATE POLICY "reconciliation_logs_update" ON reconciliation_logs FOR UPDATE
  USING (venue_id IN (SELECT v.id FROM venues v WHERE v.org_id IN (SELECT get_user_org_ids())));
DROP POLICY IF EXISTS "reconciliation_logs_delete" ON reconciliation_logs;
CREATE POLICY "reconciliation_logs_delete" ON reconciliation_logs FOR DELETE
  USING (venue_id IN (SELECT v.id FROM venues v WHERE v.org_id IN (SELECT get_user_org_ids())));

-- 12. reconciliation_line_items RLS
DROP POLICY IF EXISTS "reconciliation_line_items_select" ON reconciliation_line_items;
CREATE POLICY "reconciliation_line_items_select" ON reconciliation_line_items FOR SELECT
  USING (reconciliation_id IN (
    SELECT r.id FROM reconciliation_logs r JOIN venues v ON v.id = r.venue_id
    WHERE v.org_id IN (SELECT get_user_org_ids())
  ));
DROP POLICY IF EXISTS "reconciliation_line_items_insert" ON reconciliation_line_items;
CREATE POLICY "reconciliation_line_items_insert" ON reconciliation_line_items FOR INSERT
  WITH CHECK (reconciliation_id IN (
    SELECT r.id FROM reconciliation_logs r JOIN venues v ON v.id = r.venue_id
    WHERE v.org_id IN (SELECT get_user_org_ids())
  ));
DROP POLICY IF EXISTS "reconciliation_line_items_update" ON reconciliation_line_items;
CREATE POLICY "reconciliation_line_items_update" ON reconciliation_line_items FOR UPDATE
  USING (reconciliation_id IN (
    SELECT r.id FROM reconciliation_logs r JOIN venues v ON v.id = r.venue_id
    WHERE v.org_id IN (SELECT get_user_org_ids())
  ));
DROP POLICY IF EXISTS "reconciliation_line_items_delete" ON reconciliation_line_items;
CREATE POLICY "reconciliation_line_items_delete" ON reconciliation_line_items FOR DELETE
  USING (reconciliation_id IN (
    SELECT r.id FROM reconciliation_logs r JOIN venues v ON v.id = r.venue_id
    WHERE v.org_id IN (SELECT get_user_org_ids())
  ));
