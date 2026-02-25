/**
 * GET /api/square/auth?org_id=xxx&venue_id=yyy
 *
 * Starts the Square OAuth flow by redirecting the browser to Square's
 * authorization page. The org_id and venue_id are packed into the
 * `state` parameter so the callback can associate the connection.
 */
import type { VercelRequest, VercelResponse } from './_lib.js'
import { env, SQUARE_BASE, SQUARE_SCOPES, extractToken, verifyUser, checkOrgAccess, signState } from './_lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Authenticate caller ──────────────────────────────────────
  const token = extractToken(req)
  if (!token) {
    return res.redirect(`${env('APP_URL')}/login`)
  }

  const authResult = await verifyUser(token)
  if (authResult.error) {
    return res.redirect(`${env('APP_URL')}/login`)
  }

  try {
    const orgId = req.query.org_id as string
    const venueId = req.query.venue_id as string

    if (!orgId || !venueId) {
      return res.status(400).json({ error: 'org_id and venue_id are required' })
    }

    // ── Verify org membership (via RLS on user's JWT) ─────────
    const hasAccess = await checkOrgAccess(token!, orgId)
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden — not a member of this organisation' })
    }

    const state = signState({ org_id: orgId, venue_id: venueId })
    const redirectUri = `${env('APP_URL')}/api/square/callback`

    const authorizeUrl = [
      `${SQUARE_BASE}/oauth2/authorize`,
      `?client_id=${env('SQUARE_APP_ID')}`,
      `&scope=${SQUARE_SCOPES}`,
      `&session=false`,
      `&state=${state}`,
      `&redirect_uri=${encodeURIComponent(redirectUri)}`,
    ].join('')

    return res.redirect(authorizeUrl)
  } catch (err: any) {
    console.error('[square/auth] Error:', err)
    return res.status(500).json({ error: err.message ?? 'Internal server error' })
  }
}
