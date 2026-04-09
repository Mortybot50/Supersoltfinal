import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { resetOrganization } from '../../supabase/seed'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' })
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { orgId } = req.query
    if (!orgId || typeof orgId !== 'string') {
      return res.status(400).json({ error: 'Missing orgId parameter' })
    }

    // Get auth token from header
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = authHeader.substring(7)

    // Verify token and check user has access to this org
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Check user is owner of the org
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single()

    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to reset this organization' })
    }

    // Reset the organization
    await resetOrganization(orgId)

    return res.status(200).json({
      success: true,
      message: `Organization ${orgId} has been reset`
    })

  } catch (error) {
    console.error('Reset error:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to reset organization' 
    })
  }
}