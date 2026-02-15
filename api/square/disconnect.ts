/**
 * POST /api/square/disconnect
 * Body: { org_id: string }
 *
 * Revokes the Square OAuth token and deactivates the connection.
 *   1. Looks up the active pos_connection for the org
 *   2. Calls Square's /oauth2/revoke to invalidate the token
 *   3. Sets is_active = false on the pos_connection
 *   4. Deactivates all related pos_location_mappings
 */
import type { VercelRequest, VercelResponse } from './_lib.js'
import { env, supabaseAdmin, SQUARE_BASE, decrypt, extractToken, verifyUser, checkOrgAccess } from './_lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Authenticate caller ──────────────────────────────────────
  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' })
  }

  const authResult = await verifyUser(token)
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error })
  }

  const db = supabaseAdmin()

  try {
    const { org_id } = req.body ?? {}
    if (!org_id) {
      return res.status(400).json({ error: 'org_id is required' })
    }

    // ── Verify org membership (via RLS on user's JWT) ─────────
    const hasAccess = await checkOrgAccess(token!, org_id)
    if (!hasAccess) {
      console.error('[square/disconnect] Access check failed:', { userId: authResult.user.id, org_id })
      return res.status(403).json({ error: 'Forbidden — not a member of this organisation' })
    }

    // ── Find active connection ──────────────────────────────────
    const { data: conn, error: connErr } = await db
      .from('pos_connections')
      .select('id, access_token, merchant_id')
      .eq('org_id', org_id)
      .eq('provider', 'square')
      .eq('is_active', true)
      .single()

    if (connErr || !conn) {
      return res.status(404).json({ error: 'No active Square connection found' })
    }

    // ── Revoke token with Square ────────────────────────────────
    if (conn.access_token) {
      const plainToken = decrypt(conn.access_token)
      const revokeRes = await fetch(`${SQUARE_BASE}/oauth2/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Client ${env('SQUARE_APP_SECRET')}`,
        },
        body: JSON.stringify({
          client_id: env('SQUARE_APP_ID'),
          access_token: plainToken,
        }),
      })

      if (!revokeRes.ok) {
        const text = await revokeRes.text()
        console.error('[square/disconnect] Revoke API error:', text)
        // Continue anyway — we still want to deactivate locally
      }
    }

    // ── Deactivate connection ───────────────────────────────────
    const { error: updateErr } = await db
      .from('pos_connections')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
      })
      .eq('id', conn.id)

    if (updateErr) {
      console.error('[square/disconnect] DB update error:', updateErr)
      return res.status(500).json({ error: 'Failed to deactivate connection' })
    }

    // ── Deactivate location mappings ────────────────────────────
    await db
      .from('pos_location_mappings')
      .update({ is_active: false })
      .eq('pos_connection_id', conn.id)

    return res.status(200).json({ success: true, disconnected: true })
  } catch (err: any) {
    console.error('[square/disconnect] Error:', err)
    return res.status(500).json({ error: err.message ?? 'Disconnect failed' })
  }
}
