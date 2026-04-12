#!/bin/bash

# Supabase project details
PROJECT_REF="vcfmouckydhsmvfoykms"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

# Check if we have service role key
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "SUPABASE_SERVICE_ROLE_KEY not set. Looking for it in .env files..."
    if [ -f .env ]; then
        export $(grep SUPABASE_SERVICE_ROLE_KEY .env | xargs)
    fi
fi

# SQL to fix RLS policies
SQL_QUERY=$(cat << 'SQLEOF'
-- Drop ALL existing policies on organizations
DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update organization" ON organizations;
DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_update" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

-- Create new comprehensive policies
CREATE POLICY "Anyone can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "View own organizations"
ON organizations FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  )
  OR NOT EXISTS (SELECT 1 FROM org_members WHERE org_id = organizations.id)
);

CREATE POLICY "Update own organizations"
ON organizations FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT org_id FROM org_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'manager')
  )
);

-- Return success message
SELECT 'RLS policies fixed successfully' as result;
SQLEOF
)

# Execute using Supabase Management API if we have a service role key
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Executing SQL with service role key..."
    curl -X POST "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
        -H "Content-Type: application/json" \
        -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
        -d "{\"query\": \"${SQL_QUERY}\"}"
else
    echo "No service role key found. Please run this SQL manually in Supabase SQL Editor:"
    echo ""
    echo "$SQL_QUERY"
fi
