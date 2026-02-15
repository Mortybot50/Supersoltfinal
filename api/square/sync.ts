/**
 * POST /api/square/sync
 * Body: { org_id: string, venue_id?: string }
 *
 * Pulls orders from Square and inserts them into the `orders` table
 * (which Dashboard + Sales read from). Also writes to `sales_transactions`
 * for POS sync tracking.
 *
 * Handles:
 *   - Pagination via cursor
 *   - Dedup via source + external_id on orders table
 *   - Automatic token refresh on 401
 *   - Updates last_sync_at / last_sync_status on pos_connections
 */
import type { VercelRequest, VercelResponse } from './_lib.js'
import { env, supabaseAdmin, SQUARE_BASE, refreshSquareToken, decrypt, encrypt, extractToken, verifyUser, checkOrgAccess } from './_lib.js'

interface SquareOrder {
  id: string
  location_id: string
  created_at: string
  state: string
  total_money?: { amount: number; currency: string }
  total_tax_money?: { amount: number; currency: string }
  total_discount_money?: { amount: number; currency: string }
  line_items?: {
    uid: string
    name: string
    quantity: string
    total_money?: { amount: number; currency: string }
  }[]
  tenders?: {
    type: string
    amount_money?: { amount: number; currency: string }
  }[]
  refunds?: { id: string }[]
  source?: { name: string }
}

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
    const { org_id, venue_id } = req.body ?? {}
    if (!org_id) {
      return res.status(400).json({ error: 'org_id is required' })
    }

    // ── Verify org membership (via RLS on user's JWT) ─────────
    const hasAccess = await checkOrgAccess(token!, org_id)
    if (!hasAccess) {
      console.error('[square/sync] Access check failed:', { userId: authResult.user.id, org_id })
      return res.status(403).json({ error: 'Forbidden — not a member of this organisation' })
    }

    // ── Load connection ─────────────────────────────────────────
    const { data: conn, error: connErr } = await db
      .from('pos_connections')
      .select('*')
      .eq('org_id', org_id)
      .eq('provider', 'square')
      .eq('is_active', true)
      .single()

    if (connErr || !conn) {
      return res.status(404).json({ error: 'No active Square connection found' })
    }

    let accessToken = decrypt(conn.access_token!)
    const refreshToken = decrypt(conn.refresh_token!)

    // ── Resolve location IDs to sync ────────────────────────────
    const locationQuery = db
      .from('pos_location_mappings')
      .select('pos_location_id, venue_id')
      .eq('pos_connection_id', conn.id)
      .eq('is_active', true)

    if (venue_id) {
      locationQuery.eq('venue_id', venue_id)
    }

    const { data: locationMaps } = await locationQuery
    if (!locationMaps || locationMaps.length === 0) {
      return res.status(400).json({ error: 'No active location mappings found' })
    }

    const locationToVenue = new Map(locationMaps.map((m) => [m.pos_location_id, m.venue_id]))
    const locationIds = [...locationToVenue.keys()]

    // ── Determine sync window ───────────────────────────────────
    const syncFrom = conn.sync_from_date ?? conn.last_sync_at ?? new Date(Date.now() - 7 * 86400000).toISOString()

    // ── Fetch orders with pagination ────────────────────────────
    let cursor: string | undefined
    let allOrders: SquareOrder[] = []
    let retried = false

    const fetchPage = async (): Promise<{ orders: SquareOrder[]; cursor?: string }> => {
      const body: Record<string, any> = {
        location_ids: locationIds,
        query: {
          filter: {
            date_time_filter: {
              created_at: { start_at: syncFrom },
            },
            state_filter: { states: ['COMPLETED'] },
          },
          sort: { sort_field: 'CREATED_AT', sort_order: 'ASC' },
        },
        limit: 100,
      }
      if (cursor) body.cursor = cursor

      const orderRes = await fetch(`${SQUARE_BASE}/v2/orders/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      // Handle 401 — refresh token and retry once
      if (orderRes.status === 401 && !retried) {
        retried = true
        const newTokens = await refreshSquareToken(refreshToken)
        accessToken = newTokens.access_token

        // Persist new tokens (encrypted)
        await db
          .from('pos_connections')
          .update({
            access_token: encrypt(newTokens.access_token),
            refresh_token: encrypt(newTokens.refresh_token),
            token_expires_at: newTokens.expires_at,
          })
          .eq('id', conn.id)

        return fetchPage() // Retry with new token
      }

      if (!orderRes.ok) {
        const text = await orderRes.text()
        throw new Error(`Square API error: ${orderRes.status} ${text}`)
      }

      const data = await orderRes.json()
      return { orders: data.orders ?? [], cursor: data.cursor }
    }

    // Paginate through all results
    do {
      const page = await fetchPage()
      allOrders = allOrders.concat(page.orders)
      cursor = page.cursor
    } while (cursor)

    // ── Map & insert into orders table (primary) ────────────────
    let synced = 0
    let skipped = 0

    if (allOrders.length > 0) {
      const mappedOrders = allOrders
        .filter((order) => locationToVenue.has(order.location_id))

      // Build rows for the `orders` table (what Dashboard + Sales read)
      const orderRows = mappedOrders.map((order) => {
        const venueId = locationToVenue.get(order.location_id)!
        const grossAmount = order.total_money?.amount ?? 0
        const taxAmount = order.total_tax_money?.amount ?? 0
        const discountAmount = order.total_discount_money?.amount ?? 0
        const netAmount = grossAmount - taxAmount
        const paymentMethod = mapSquareTender(order.tenders?.[0]?.type)
        const isRefund = (order.refunds?.length ?? 0) > 0
        const channel = mapSquareChannel(order.source?.name)

        return {
          venue_id: venueId,
          order_number: `SQ-${order.id.slice(0, 12)}`,
          order_datetime: order.created_at,
          channel,
          gross_amount: grossAmount,
          tax_amount: taxAmount,
          net_amount: netAmount,
          discount_amount: discountAmount,
          is_refund: isRefund,
          is_void: false,
          payment_method: paymentMethod,
          source: 'square',
          external_id: order.id,
        }
      })

      // Batch upsert into `orders` (dedup on source + external_id unique index)
      const BATCH_SIZE = 200
      for (let i = 0; i < orderRows.length; i += BATCH_SIZE) {
        const batch = orderRows.slice(i, i + BATCH_SIZE)
        const { error: upsertErr } = await db
          .from('orders')
          .upsert(batch, {
            onConflict: 'source,external_id',
            ignoreDuplicates: true,
          })

        if (upsertErr) {
          console.error('[square/sync] Orders upsert error:', upsertErr)
          skipped += batch.length
        } else {
          synced += batch.length
        }
      }

      // Also write to sales_transactions for POS tracking / sync log
      const trackingRows = mappedOrders.map((order) => {
        const venueId = locationToVenue.get(order.location_id)!
        const total = order.total_money?.amount ?? 0
        const tax = order.total_tax_money?.amount ?? 0
        const discount = order.total_discount_money?.amount ?? 0
        const subtotal = total - tax
        const itemCount = order.line_items?.reduce((n, li) => n + parseInt(li.quantity || '0', 10), 0) ?? 0
        const paymentMethod = mapSquareTender(order.tenders?.[0]?.type)
        const isRefund = (order.refunds?.length ?? 0) > 0
        const orderType = order.source?.name ?? 'square'
        const createdAt = new Date(order.created_at)

        return {
          org_id,
          venue_id: venueId,
          pos_connection_id: conn.id,
          pos_transaction_id: order.id,
          transaction_type: isRefund ? 'refund' : 'sale',
          transaction_at: order.created_at,
          transaction_date: createdAt.toISOString().slice(0, 10),
          transaction_time: createdAt.toISOString().slice(11, 19),
          total,
          subtotal,
          gst_amount: tax,
          discount_amount: discount,
          item_count: itemCount,
          payment_method: paymentMethod,
          order_type: orderType,
          synced_at: new Date().toISOString(),
        }
      })

      for (let i = 0; i < trackingRows.length; i += BATCH_SIZE) {
        const batch = trackingRows.slice(i, i + BATCH_SIZE)
        await db
          .from('sales_transactions')
          .upsert(batch, {
            onConflict: 'pos_transaction_id',
            ignoreDuplicates: true,
          })
          .then(({ error }) => {
            if (error) console.error('[square/sync] Tracking upsert error:', error)
          })
      }
    }

    // ── Update connection sync status ───────────────────────────
    await db
      .from('pos_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: synced > 0 ? 'success' : 'no_new_orders',
      })
      .eq('id', conn.id)

    return res.status(200).json({
      success: true,
      orders_fetched: allOrders.length,
      synced,
      skipped,
      sync_from: syncFrom,
    })
  } catch (err: any) {
    console.error('[square/sync] Error:', err)

    // Try to record the failure
    try {
      const { org_id } = req.body ?? {}
      if (org_id) {
        await db
          .from('pos_connections')
          .update({ last_sync_status: `error: ${err.message?.slice(0, 200)}` })
          .eq('org_id', org_id)
          .eq('provider', 'square')
      }
    } catch { /* best effort */ }

    return res.status(500).json({ error: err.message ?? 'Sync failed' })
  }
}

/** Map Square source name to a channel the app recognises */
function mapSquareChannel(sourceName?: string): string {
  if (!sourceName) return 'dine-in'
  const lower = sourceName.toLowerCase()
  if (lower.includes('online') || lower.includes('ecommerce')) return 'online'
  if (lower.includes('delivery') || lower.includes('doordash') || lower.includes('uber')) return 'delivery'
  if (lower.includes('takeout') || lower.includes('pickup') || lower.includes('takeaway')) return 'takeaway'
  return 'dine-in'
}

/** Map Square tender type to app payment_method values */
function mapSquareTender(tenderType?: string): string {
  if (!tenderType) return 'unknown'
  switch (tenderType) {
    case 'CASH': return 'cash'
    case 'CARD': return 'card'
    case 'WALLET': return 'digital_wallet'
    case 'SQUARE_GIFT_CARD': return 'gift_card'
    case 'BUY_NOW_PAY_LATER': return 'bnpl'
    case 'BANK_ACCOUNT': return 'bank_transfer'
    case 'NO_SALE': return 'no_sale'
    default: return tenderType.toLowerCase()
  }
}
