-- Venue Templates table for saving reusable venue configurations
CREATE TABLE IF NOT EXISTS venue_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE venue_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates for their org"
  ON venue_templates FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users can insert templates for their org"
  ON venue_templates FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users can update templates for their org"
  ON venue_templates FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Users can delete templates for their org"
  ON venue_templates FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE INDEX idx_venue_templates_org_id ON venue_templates(org_id);
