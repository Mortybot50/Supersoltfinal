/**
 * POST /api/square/sync
 * Body: { org_id: string, venue_id?: string }
 *
 * Pulls orders from Square and upserts them into `sales_transactions`.
 * Handles:
 *   - Pagination via cursor
 *   - Dedup via pos_transaction_id
 *   - Automatic token refresh on 401
 *   - Updates last_sync_at / last_sync_status on pos_connections
 */
import type { VercelRequest, VercelResponse } from './_lib'
import { env, supabaseAdmin, SQUARE_BASE, refreshSquareToken } from './_lib'

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

  const db = supabaseAdmin()

  try {
    const { org_id, venue_id } = req.body ?? {}
    if (!org_id) {
      return res.status(400).json({ error: 'org_id is required' })
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

    let accessToken = conn.access_token!
    const refreshToken = conn.refresh_token!

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

        // Persist new tokens
        await db
          .from('pos_connections')
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
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

    // ── Map & upsert into sales_transactions ────────────────────
    let synced = 0
    let skipped = 0

    if (allOrders.length > 0) {
      const rows = allOrders
        .filter((order) => locationToVenue.has(order.location_id))
        .map((order) => {
          const venueId = locationToVenue.get(order.location_id)!
          const total = order.total_money?.amount ?? 0
          const tax = order.total_tax_money?.amount ?? 0
          const discount = order.total_discount_money?.amount ?? 0
          const subtotal = total - tax
          const itemCount = order.line_items?.reduce((n, li) => n + parseInt(li.quantity || '0', 10), 0) ?? 0
          const paymentMethod = order.tenders?.[0]?.type?.toLowerCase() ?? 'unknown'
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

      // Batch upsert (dedup on pos_transaction_id)
      const BATCH_SIZE = 200
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const { error: upsertErr, count } = await db
          .from('sales_transactions')
          .upsert(batch, {
            onConflict: 'pos_transaction_id',
            ignoreDuplicates: false,
          })

        if (upsertErr) {
          console.error('[square/sync] Upsert error:', upsertErr)
          skipped += batch.length
        } else {
          synced += batch.length
        }
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
