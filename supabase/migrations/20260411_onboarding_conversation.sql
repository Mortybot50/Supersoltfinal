-- Agentic onboarding conversation state and progressive tasks
CREATE TABLE conversation_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES organizations(id),
  conversation_history JSONB NOT NULL DEFAULT '[]',
  current_step TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE progressive_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  task_type TEXT NOT NULL,
  task_data JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE progressive_tasks ENABLE ROW LEVEL SECURITY;

-- conversation_states policies
CREATE POLICY "Users can read own conversation state" 
  ON conversation_states FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversation state" 
  ON conversation_states FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversation state" 
  ON conversation_states FOR UPDATE 
  USING (auth.uid() = user_id);

-- progressive_tasks policies  
CREATE POLICY "Org members can view tasks" 
  ON progressive_tasks FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM org_members om
      WHERE om.org_id = progressive_tasks.org_id 
      AND om.user_id = auth.uid()
      AND om.is_active = true
    )
  );

CREATE POLICY "Service role can manage tasks" 
  ON progressive_tasks FOR ALL 
  USING (auth.jwt()->>'role' = 'service_role');

-- Indexes
CREATE INDEX idx_conversation_states_user_id ON conversation_states(user_id);
CREATE INDEX idx_conversation_states_org_id ON conversation_states(org_id);
CREATE INDEX idx_progressive_tasks_org_id ON progressive_tasks(org_id);
CREATE INDEX idx_progressive_tasks_scheduled_for ON progressive_tasks(scheduled_for) WHERE completed_at IS NULL;