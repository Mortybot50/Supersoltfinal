/**
 * POST /api/xero/disconnect
 *
 * Revokes the Xero connection for the given org.
 * Removes Xero's refresh grant and marks the connection inactive.
 *
 * Body: { org_id: string }
 *
 * ENV VARS NEEDED: ENCRYPTION_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import type { VercelRequest, VercelResponse } from './_lib'
import { requireXeroConfig,
  extractToken, verifyUser, checkOrgAccess,
  supabaseAdmin, decrypt, XERO_OAUTH_BASE,
} from './_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireXeroConfig(res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body as { org_id?: string } | undefined
    const orgId = body?.org_id
    if (!orgId) return res.status(400).json({ error: 'org_id required' })

    const token = extractToken(req)
    if (!token) return res.status(401).json({ error: 'Authentication required' })

    const { user, error, status } = await verifyUser(token)
    if (!user) return res.status(status!).json({ error })

    const hasAccess = await checkOrgAccess(token, orgId)
    if (!hasAccess) return res.status(403).json({ error: 'No access to this organisation' })

    const db = supabaseAdmin()

    const { data: conn } = await db
      .from('xero_connections' as 'pos_connections')
      .select('id, refresh_token')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .single() as { data: { id: string; refresh_token: string | null } | null }

    if (!conn) {
      return res.status(404).json({ error: 'No active Xero connection found' })
    }

    // Revoke the Xero refresh grant (best-effort — don't fail if it errors)
    if (conn.refresh_token) {
      try {
        const refreshToken = decrypt(conn.refresh_token)
        await fetch(`${XERO_OAUTH_BASE}/revocation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: refreshToken }).toString(),
        })
      } catch (revokeErr) {
        console.warn('[xero/disconnect] Token revocation failed (continuing):', revokeErr)
      }
    }

    // Mark connection inactive and clear tokens
    await db
      .from('xero_connections' as 'pos_connections')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
      } as Record<string, unknown>)
      .eq('id', conn.id)

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[xero/disconnect] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
