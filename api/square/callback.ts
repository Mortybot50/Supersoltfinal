/**
 * GET /api/square/callback?code=xxx&state=yyy
 *
 * Square redirects here after the merchant authorises the app.
 * This handler:
 *   1. Exchanges the authorization code for access + refresh tokens
 *   2. Fetches the merchant's Square locations
 *   3. Upserts a row in `pos_connections`
 *   4. Upserts rows in `pos_location_mappings`
 *   5. Redirects the user back to the Integrations page
 */
import type { VercelRequest, VercelResponse } from './_lib.js'
import { env, supabaseAdmin, SQUARE_BASE, encrypt } from './_lib.js'

const INTEGRATIONS_PATH = '/admin/integrations'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[square/callback] Handler invoked', { method: req.method, query: req.query })

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Debug: verify which key supabaseAdmin is using
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  console.log('[square/callback] supabaseAdmin check:', {
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    keyPrefix: serviceKey.substring(0, 20),
    isServiceRole: serviceKey.includes('service_role'),
  })

  const db = supabaseAdmin()

  try {
    const code = req.query.code as string
    const stateRaw = req.query.state as string

    if (!code || !stateRaw) {
      console.error('[square/callback] Missing code or state', { code: !!code, state: !!stateRaw })
      return res.status(400).json({ error: 'Missing code or state parameter' })
    }

    // ── Decode state ────────────────────────────────────────────
    let state: { org_id: string; venue_id: string }
    try {
      state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString())
    } catch {
      console.error('[square/callback] Invalid state parameter:', stateRaw)
      return res.status(400).json({ error: 'Invalid state parameter' })
    }

    console.log('[square/callback] Decoded state:', JSON.stringify(state))

    if (!state.org_id || !state.venue_id) {
      return res.redirect(`${env('APP_URL')}${INTEGRATIONS_PATH}?error=invalid_state`)
    }

    // ── Validate org_id and venue_id exist in DB ──────────────
    const { data: org, error: orgErr } = await db
      .from('organizations')
      .select('id')
      .eq('id', state.org_id)
      .single()

    if (orgErr || !org) {
      console.error('[square/callback] Invalid org_id:', { org_id: state.org_id, error: orgErr?.message })
      return res.redirect(`${env('APP_URL')}${INTEGRATIONS_PATH}?error=invalid_org`)
    }

    const { data: venue, error: venueErr } = await db
      .from('venues')
      .select('id')
      .eq('id', state.venue_id)
      .eq('org_id', state.org_id)
      .single()

    if (venueErr || !venue) {
      console.error('[square/callback] Invalid venue_id:', { venue_id: state.venue_id, error: venueErr?.message })
      return res.redirect(`${env('APP_URL')}${INTEGRATIONS_PATH}?error=invalid_venue`)
    }

    // ── Exchange code for tokens ────────────────────────────────
    console.log('[square/callback] Exchanging authorization code for tokens...')
    const tokenRes = await fetch(`${SQUARE_BASE}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env('SQUARE_APP_ID'),
        client_secret: env('SQUARE_APP_SECRET'),
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${env('APP_URL')}/api/square/callback`,
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      console.error('[square/callback] Token exchange failed:', tokenRes.status, text)
      return res.redirect(`${env('APP_URL')}${INTEGRATIONS_PATH}?error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json() as {
      access_token: string
      refresh_token: string
      expires_at: string
      merchant_id: string
    }

    console.log('[square/callback] Token exchange OK:', { merchant_id: tokenData.merchant_id, expires_at: tokenData.expires_at })

    // ── Fetch merchant locations ────────────────────────────────
    const locRes = await fetch(`${SQUARE_BASE}/v2/locations`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    let locations: { id: string; name: string }[] = []
    if (locRes.ok) {
      const locData = await locRes.json() as { locations?: { id: string; name: string }[] }
      locations = (locData.locations ?? []).map((l) => ({ id: l.id, name: l.name }))
    }

    console.log('[square/callback] Locations fetched:', locations.length, locations.map((l) => l.name))

    // ── Fetch merchant name ─────────────────────────────────────
    let merchantName = tokenData.merchant_id
    const merchantRes = await fetch(`${SQUARE_BASE}/v2/merchants/${tokenData.merchant_id}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    if (merchantRes.ok) {
      const merchantData = await merchantRes.json() as { merchant?: { business_name?: string } }
      merchantName = merchantData.merchant?.business_name ?? merchantName
    }

    console.log('[square/callback] Merchant name:', merchantName)

    // ── Upsert pos_connections (tokens encrypted at rest) ───────
    const upsertPayload = {
      org_id: state.org_id,
      provider: 'square',
      merchant_id: tokenData.merchant_id,
      merchant_name: merchantName,
      access_token: encrypt(tokenData.access_token),
      refresh_token: encrypt(tokenData.refresh_token),
      token_expires_at: tokenData.expires_at,
      is_active: true,
    }

    console.log('[square/callback] Upserting pos_connections:', { org_id: upsertPayload.org_id, provider: upsertPayload.provider, merchant_id: upsertPayload.merchant_id })

    const { data: connection, error: connError } = await db
      .from('pos_connections')
      .upsert(upsertPayload, { onConflict: 'org_id,provider' })
      .select('id')
      .single()

    if (connError) {
      console.error('[square/callback] DB upsert error:', JSON.stringify(connError))
      return res.redirect(`${env('APP_URL')}${INTEGRATIONS_PATH}?error=db_error`)
    }

    console.log('[square/callback] Connection upserted:', connection.id)

    // ── Upsert pos_location_mappings ────────────────────────────
    if (connection && locations.length > 0) {
      const mappings = locations.map((loc, idx) => ({
        pos_connection_id: connection.id,
        pos_location_id: loc.id,
        pos_location_name: loc.name,
        venue_id: state.venue_id,
        is_active: idx === 0,
      }))

      console.log('[square/callback] Upserting location mappings:', mappings.length)

      const { error: mapError } = await db
        .from('pos_location_mappings')
        .upsert(mappings, { onConflict: 'pos_connection_id,pos_location_id' })

      if (mapError) {
        console.error('[square/callback] Location mapping error:', JSON.stringify(mapError))
        // Non-fatal — continue to redirect
      } else {
        console.log('[square/callback] Location mappings saved')
      }
    }

    console.log('[square/callback] Success — redirecting to integrations page')
    return res.redirect(`${env('APP_URL')}${INTEGRATIONS_PATH}?connected=square`)
  } catch (err: any) {
    console.error('[square/callback] Unhandled error:', err)
    return res.redirect(`${env('APP_URL')}${INTEGRATIONS_PATH}?error=unknown`)
  }
}
