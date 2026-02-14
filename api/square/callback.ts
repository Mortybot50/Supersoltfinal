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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const db = supabaseAdmin()

  try {
    const code = req.query.code as string
    const stateRaw = req.query.state as string

    if (!code || !stateRaw) {
      return res.status(400).json({ error: 'Missing code or state parameter' })
    }

    // ── Decode state ────────────────────────────────────────────
    let state: { org_id: string; venue_id: string }
    try {
      state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString())
    } catch {
      return res.status(400).json({ error: 'Invalid state parameter' })
    }

    // ── Exchange code for tokens ────────────────────────────────
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
      console.error('[square/callback] Token exchange failed:', text)
      return res.redirect(`${env('APP_URL')}/integrations?error=token_exchange_failed`)
    }

    const tokenData = await tokenRes.json() as {
      access_token: string
      refresh_token: string
      expires_at: string
      merchant_id: string
    }

    // ── Fetch merchant locations ────────────────────────────────
    const locRes = await fetch(`${SQUARE_BASE}/v2/locations`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    let locations: { id: string; name: string }[] = []
    if (locRes.ok) {
      const locData = await locRes.json() as { locations?: { id: string; name: string }[] }
      locations = (locData.locations ?? []).map((l) => ({ id: l.id, name: l.name }))
    }

    // ── Fetch merchant name ─────────────────────────────────────
    let merchantName = tokenData.merchant_id
    const merchantRes = await fetch(`${SQUARE_BASE}/v2/merchants/${tokenData.merchant_id}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    if (merchantRes.ok) {
      const merchantData = await merchantRes.json() as { merchant?: { business_name?: string } }
      merchantName = merchantData.merchant?.business_name ?? merchantName
    }

    // ── Upsert pos_connections (tokens encrypted at rest) ───────
    const { data: connection, error: connError } = await db
      .from('pos_connections')
      .upsert(
        {
          org_id: state.org_id,
          provider: 'square',
          merchant_id: tokenData.merchant_id,
          merchant_name: merchantName,
          access_token: encrypt(tokenData.access_token),
          refresh_token: encrypt(tokenData.refresh_token),
          token_expires_at: tokenData.expires_at,
          is_active: true,
        },
        { onConflict: 'org_id,provider' },
      )
      .select('id')
      .single()

    if (connError) {
      console.error('[square/callback] DB upsert error:', connError)
      return res.redirect(`${env('APP_URL')}/integrations?error=db_error`)
    }

    // ── Upsert pos_location_mappings ────────────────────────────
    if (connection && locations.length > 0) {
      // Map the first location to the venue from state; rest are unmapped
      const mappings = locations.map((loc, idx) => ({
        pos_connection_id: connection.id,
        pos_location_id: loc.id,
        pos_location_name: loc.name,
        venue_id: idx === 0 ? state.venue_id : state.venue_id, // all map to same venue initially
        is_active: idx === 0,
      }))

      const { error: mapError } = await db
        .from('pos_location_mappings')
        .upsert(mappings, { onConflict: 'pos_connection_id,pos_location_id' })

      if (mapError) {
        console.error('[square/callback] Location mapping error:', mapError)
        // Non-fatal — continue to redirect
      }
    }

    return res.redirect(`${env('APP_URL')}/integrations?connected=square`)
  } catch (err: any) {
    console.error('[square/callback] Error:', err)
    return res.redirect(`${env('APP_URL')}/integrations?error=unknown`)
  }
}
