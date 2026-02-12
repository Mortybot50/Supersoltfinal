/**
 * GET /api/square/auth?org_id=xxx&venue_id=yyy
 *
 * Starts the Square OAuth flow by redirecting the browser to Square's
 * authorization page. The org_id and venue_id are packed into the
 * `state` parameter so the callback can associate the connection.
 */
import type { VercelRequest, VercelResponse } from './_lib'
import { env, SQUARE_BASE, SQUARE_SCOPES } from './_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const orgId = req.query.org_id as string
    const venueId = req.query.venue_id as string

    if (!orgId || !venueId) {
      return res.status(400).json({ error: 'org_id and venue_id are required' })
    }

    const state = Buffer.from(JSON.stringify({ org_id: orgId, venue_id: venueId })).toString('base64url')
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
