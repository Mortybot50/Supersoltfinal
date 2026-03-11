/**
 * GET /api/xero/callback
 *
 * Handles the OAuth 2.0 callback from Xero.
 * Exchanges the auth code for tokens, fetches the connected Xero tenant,
 * stores encrypted tokens in xero_connections, seeds default account mappings,
 * then redirects back to the admin Integrations page.
 *
 * ENV VARS NEEDED:
 *   XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI,
 *   ENCRYPTION_KEY, APP_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import type { VercelRequest, VercelResponse } from './_lib'
import {
  env, supabaseAdmin, verifyState, encrypt,
  XERO_API_BASE, XERO_OAUTH_BASE, DEFAULT_AU_ACCOUNT_MAPPINGS,
} from './_lib'

interface XeroTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

interface XeroTenant {
  tenantId: string
  tenantName: string
  tenantType: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const appUrl = env('APP_URL')
  const errorRedirect = (code: string) =>
    res.redirect(302, `${appUrl}/admin/integrations?error=${code}`)

  try {
    const code  = req.query.code  as string | undefined
    const state = req.query.state as string | undefined

    if (!code)  return errorRedirect('missing_code')
    if (!state) return errorRedirect('missing_state')

    // Verify CSRF state
    let statePayload: Record<string, string>
    try {
      statePayload = verifyState(state)
    } catch {
      return errorRedirect('invalid_state')
    }

    const { org_id: orgId } = statePayload
    if (!orgId) return errorRedirect('missing_org_id')

    const db = supabaseAdmin()

    // Verify org exists
    const { data: org } = await db.from('organizations').select('id').eq('id', orgId).maybeSingle()
    if (!org) return errorRedirect('org_not_found')

    // Exchange auth code for tokens
    const credentials = Buffer.from(
      `${env('XERO_CLIENT_ID')}:${env('XERO_CLIENT_SECRET')}`
    ).toString('base64')

    const tokenRes = await fetch(`${XERO_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: env('XERO_REDIRECT_URI'),
      }).toString(),
    })

    if (!tokenRes.ok) {
      console.error('[xero/callback] Token exchange failed:', await tokenRes.text())
      return errorRedirect('token_exchange_failed')
    }

    const tokens: XeroTokenResponse = await tokenRes.json()

    // Fetch connected Xero tenants/organisations
    const tenantsRes = await fetch(`${XERO_API_BASE}/connections`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!tenantsRes.ok) {
      console.error('[xero/callback] Failed to fetch tenants:', await tenantsRes.text())
      return errorRedirect('tenants_fetch_failed')
    }

    const tenants: XeroTenant[] = await tenantsRes.json()
    if (!tenants.length) return errorRedirect('no_tenants')

    // Use the first tenant (most orgs have one Xero org)
    const tenant = tenants[0]

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Upsert xero_connections
    const { data: conn, error: connError } = await db
      .from('xero_connections' as 'pos_connections') // cast for type until migration is applied
      .upsert({
        org_id: orgId,
        access_token: encrypt(tokens.access_token),
        refresh_token: encrypt(tokens.refresh_token),
        token_expires_at: tokenExpiresAt,
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        tenant_type: tenant.tenantType,
        is_active: true,
        last_sync_status: null,
      } as Record<string, unknown>, { onConflict: 'org_id' })
      .select('id')
      .single()

    if (connError || !conn) {
      console.error('[xero/callback] DB upsert error:', connError)
      return errorRedirect('db_error')
    }

    // Seed default AU hospitality account mappings (only if not already set)
    const { data: existingMappings } = await db
      .from('xero_account_mappings' as 'pos_connections')
      .select('supersolt_category')
      .eq('org_id', orgId) as { data: Array<{ supersolt_category: string }> | null }

    const existingCategories = new Set((existingMappings ?? []).map(m => m.supersolt_category))
    const toInsert = DEFAULT_AU_ACCOUNT_MAPPINGS
      .filter(m => !existingCategories.has(m.supersolt_category))
      .map(m => ({ org_id: orgId, ...m }))

    if (toInsert.length > 0) {
      await db
        .from('xero_account_mappings' as 'pos_connections')
        .insert(toInsert as Record<string, unknown>[])
    }

    return res.redirect(302, `${appUrl}/admin/integrations?connected=xero`)
  } catch (err) {
    console.error('[xero/callback] Unexpected error:', err)
    return errorRedirect('unknown')
  }
}
