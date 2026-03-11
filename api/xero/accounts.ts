/**
 * GET /api/xero/accounts
 *
 * Fetches the Xero chart of accounts for the connected org.
 * Used to populate the account mapping UI in Settings > Integrations.
 *
 * Returns an array of { AccountID, Code, Name, Type, Status } objects.
 *
 * ENV VARS NEEDED: ENCRYPTION_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import type { VercelRequest, VercelResponse } from './_lib'
import { requireXeroConfig,
  env, extractToken, verifyUser, checkOrgAccess,
  supabaseAdmin, decrypt, encrypt, refreshXeroToken, XERO_API_BASE,
} from './_lib'

interface XeroAccount {
  AccountID: string
  Code: string
  Name: string
  Type: string
  Status: string
}

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

    const db = supabaseAdmin()

    // Load connection
    const { data: conn } = await db
      .from('xero_connections' as 'pos_connections')
      .select('id, access_token, refresh_token, token_expires_at, tenant_id')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .single() as { data: {
        id: string
        access_token: string | null
        refresh_token: string | null
        token_expires_at: string | null
        tenant_id: string | null
      } | null }

    if (!conn?.access_token || !conn.tenant_id) {
      return res.status(404).json({ error: 'No active Xero connection' })
    }

    let accessToken = decrypt(conn.access_token)
    const tenantId = conn.tenant_id

    // Fetch accounts
    const fetchAccounts = async (at: string) =>
      fetch(`${XERO_API_BASE}/api.xro/2.0/Accounts?where=Status%3D%3D%22ACTIVE%22`, {
        headers: {
          Authorization: `Bearer ${at}`,
          'Xero-tenant-id': tenantId,
          Accept: 'application/json',
        },
      })

    let accountsRes = await fetchAccounts(accessToken)

    // Auto-refresh token if expired
    if (accountsRes.status === 401 && conn.refresh_token) {
      const newTokens = await refreshXeroToken(decrypt(conn.refresh_token))
      accessToken = newTokens.access_token
      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
      await db
        .from('xero_connections' as 'pos_connections')
        .update({
          access_token: encrypt(newTokens.access_token),
          refresh_token: encrypt(newTokens.refresh_token),
          token_expires_at: expiresAt,
        } as Record<string, unknown>)
        .eq('id', conn.id)
      accountsRes = await fetchAccounts(accessToken)
    }

    if (!accountsRes.ok) {
      const text = await accountsRes.text()
      console.error('[xero/accounts] Xero API error:', text)
      return res.status(502).json({ error: 'Failed to fetch Xero accounts' })
    }

    const data = await accountsRes.json() as { Accounts: XeroAccount[] }
    const accounts = (data.Accounts ?? []).filter(a => a.Status === 'ACTIVE')

    return res.status(200).json({ accounts })
  } catch (err) {
    console.error('[xero/accounts] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
