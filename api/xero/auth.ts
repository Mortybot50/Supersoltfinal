/**
 * GET /api/xero/auth
 *
 * Initiates the Xero OAuth 2.0 flow.
 * Verifies the calling user and org, then redirects to Xero's authorization endpoint.
 *
 * Query params:
 *   org_id   — SuperSolt organisation UUID
 *   token    — Supabase JWT (passed because browser can't set auth headers on redirects)
 *
 * ENV VARS NEEDED:
 *   XERO_CLIENT_ID, XERO_REDIRECT_URI, XERO_CLIENT_SECRET
 */

import type { VercelRequest, VercelResponse } from './_lib'
import { requireXeroConfig,
  env, extractToken, verifyUser, checkOrgAccess,
  signState, XERO_OAUTH_BASE, XERO_SCOPES,
} from './_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireXeroConfig(res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const orgId = req.query.org_id as string | undefined
    if (!orgId) return res.status(400).json({ error: 'org_id required' })

    const token = extractToken(req)
    if (!token) return res.status(401).json({ error: 'Authentication required' })

    const { user, error, status } = await verifyUser(token)
    if (!user) return res.status(status!).json({ error })

    const hasAccess = await checkOrgAccess(token, orgId)
    if (!hasAccess) return res.status(403).json({ error: 'No access to this organisation' })

    // Sign state — prevents CSRF
    const state = signState({ org_id: orgId, user_id: user.id })

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env('XERO_CLIENT_ID'),
      redirect_uri: env('XERO_REDIRECT_URI'),
      scope: XERO_SCOPES,
      state,
    })

    return res.redirect(302, `${XERO_OAUTH_BASE}/authorize?${params.toString()}`)
  } catch (err) {
    console.error('[xero/auth] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
