-- Add admin data management tables

-- Admin Data Jobs table for tracking data operations
CREATE TABLE IF NOT EXISTS admin_data_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('EXPORT_ALL', 'ORG_WIPE', 'PERSISTENCE_CHECK')),
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  details_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Admin Data Audit table for tracking data changes
CREATE TABLE IF NOT EXISTS admin_data_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_counts_json JSONB,
  after_counts_json JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_data_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_data_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now since no auth implemented yet)
CREATE POLICY "Allow all operations on admin_data_jobs" 
ON admin_data_jobs 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all operations on admin_data_audit" 
ON admin_data_audit 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_data_jobs_status ON admin_data_jobs(status);
CREATE INDEX IF NOT EXISTS idx_admin_data_jobs_created_at ON admin_data_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_data_audit_created_at ON admin_data_audit(created_at DESC);

-- Add trigger for updated_at on admin_data_jobs
CREATE TRIGGER update_admin_data_jobs_updated_at
BEFORE UPDATE ON admin_data_jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();