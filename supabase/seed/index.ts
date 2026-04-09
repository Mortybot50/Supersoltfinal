import { createClient } from '@supabase/supabase-js'
import { seedDemoData, type SeedResult } from './demo-data'
import type { Database } from '../../src/integrations/supabase/types'

export async function seedOrganization(userId: string): Promise<SeedResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  return seedDemoData(supabase, userId)
}

export async function resetOrganization(orgId: string): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Delete in reverse order of dependencies
  const tables = [
    'sales',
    'timesheets', 
    'roster_shifts',
    'roster_templates',
    'recipes',
    'menu_items',
    'ingredients',
    'purchase_orders',
    'suppliers',
    'venue_access',
    'staff',
    'venues',
    'org_members',
    'organizations'
  ]

  for (const table of tables) {
    const { error } = await supabase
      .from(table as any)
      .delete()
      .eq('org_id', orgId)

    if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
      console.warn(`Error deleting from ${table}:`, error)
    }
  }
}