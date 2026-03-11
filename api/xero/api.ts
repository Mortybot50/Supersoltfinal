/**
 * /api/xero/api
 *
 * Unified Xero API handler. Routes by query param: ?action=sync|accounts|disconnect
 * Consolidates 3 endpoints into 1 to stay within Vercel Hobby plan limit (12 functions).
 */

import type { VercelRequest, VercelResponse } from './_lib'
import { requireXeroConfig,
  extractToken, verifyUser, checkOrgAccess,
  supabaseAdmin, decrypt, encrypt, refreshXeroToken,
  XERO_API_BASE, XERO_OAUTH_BASE,
} from './_lib'


// ── Types ────────────────────────────────────────────────────────────
interface XeroAccount {
  AccountID: string
  Code: string
  Name: string
  Type: string
  Status: string
}

type SyncType = 'sales' | 'purchases' | 'payroll' | 'accounts'

interface SyncBody {
  org_id?: string
  venue_id?: string
  sync_types?: SyncType[]
  date_from?: string
  date_to?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireXeroConfig(res)) return

  const action = (req.query.action as string) || (req.method === 'GET' ? 'accounts' : 'sync')

  switch (action) {
    case 'accounts':
      return handleAccounts(req, res)
    case 'disconnect':
      return handleDisconnect(req, res)
    case 'sync':
      return handleSync(req, res)
    default:
      return res.status(400).json({ error: 'Invalid action. Use ?action=sync|accounts|disconnect' })
  }
}

// ── Accounts handler ─────────────────────────────────────────────
async function handleAccounts(req: VercelRequest, res: VercelResponse) {
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

// ── Disconnect handler ───────────────────────────────────────────
async function handleDisconnect(req: VercelRequest, res: VercelResponse) {
  if (!requireXeroConfig(res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = req.body as { org_id?: string } | undefined
    const orgId = body?.org_id
    if (!orgId) return res.status(400).json({ error: 'org_id required' })

    const token = extractToken(req)
    if (!token) return res.status(401).json({ error: 'Authentication required' })

    const { user, error, status } = await verifyUser(token)
    if (!user) return res.status(status!).json({ error })

    const hasAccess = await checkOrgAccess(token, orgId)
    if (!hasAccess) return res.status(403).json({ error: 'No access to this organisation' })

    const db = supabaseAdmin()

    const { data: conn } = await db
      .from('xero_connections' as 'pos_connections')
      .select('id, refresh_token')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .single() as { data: { id: string; refresh_token: string | null } | null }

    if (!conn) {
      return res.status(404).json({ error: 'No active Xero connection found' })
    }

    // Revoke the Xero refresh grant (best-effort — don't fail if it errors)
    if (conn.refresh_token) {
      try {
        const refreshToken = decrypt(conn.refresh_token)
        await fetch(`${XERO_OAUTH_BASE}/revocation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: refreshToken }).toString(),
        })
      } catch (revokeErr) {
        console.warn('[xero/disconnect] Token revocation failed (continuing):', revokeErr)
      }
    }

    // Mark connection inactive and clear tokens
    await db
      .from('xero_connections' as 'pos_connections')
      .update({
        is_active: false,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
      } as Record<string, unknown>)
      .eq('id', conn.id)

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[xero/disconnect] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ── Sync handler ─────────────────────────────────────────────────
async function handleSync(req: VercelRequest, res: VercelResponse) {
  if (!requireXeroConfig(res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body as SyncBody
  const { org_id: orgId, venue_id: venueId, sync_types, date_from, date_to } = body || {}

  if (!orgId) return res.status(400).json({ error: 'org_id required' })

  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Authentication required' })

  const { user, error, status } = await verifyUser(token)
  if (!user) return res.status(status!).json({ error })

  const hasAccess = await checkOrgAccess(token, orgId)
  if (!hasAccess) return res.status(403).json({ error: 'No access to this organisation' })

  const db = supabaseAdmin()

  // Load Xero connection
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
  const syncTypes: SyncType[] = sync_types ?? ['sales', 'purchases']

  // Date range — default: last 7 days
  const today = new Date()
  const defaultFrom = new Date(today)
  defaultFrom.setDate(today.getDate() - 7)
  const dateFrom = date_from ?? defaultFrom.toISOString().split('T')[0]
  const dateTo = date_to ?? today.toISOString().split('T')[0]

  // Log sync start
  const { data: logRow } = await db
    .from('xero_sync_log' as 'pos_connections')
    .insert({
      org_id: orgId,
      xero_connection_id: conn.id,
      direction: 'push',
      sync_type: syncTypes.join(','),
      status: 'pending',
    } as Record<string, unknown>)
    .select('id')
    .single() as { data: { id: string } | null }

  const results: Record<string, number> = {}
  const errors: string[] = []

  // Helper: authenticated Xero fetch with auto-refresh
  const xeroFetch = async (path: string, options: RequestInit = {}) => {
    const makeReq = () => fetch(`${XERO_API_BASE}/api.xro/2.0/${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': tenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
      },
    })

    let xeroRes = await makeReq()

    if (xeroRes.status === 401 && conn.refresh_token) {
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
      xeroRes = await makeReq()
    }

    return xeroRes
  }

  // ── SYNC: Sales → Xero Invoices ──────────────────────────────────
  if (syncTypes.includes('sales')) {
    try {
      // Load daily sales summaries from SuperSolt
      const salesQuery = db
        .from('orders')
        .select('order_datetime, gross_amount, tax_amount, venue_id')
        .eq('org_id', orgId)
        .gte('order_datetime', dateFrom)
        .lte('order_datetime', dateTo + 'T23:59:59')
        .is('is_void', false)

      if (venueId) {
        salesQuery.eq('venue_id', venueId)
      }

      const { data: orders } = await salesQuery

      if (orders && orders.length > 0) {
        // Group by date and create a daily summary invoice
        const byDate = orders.reduce<Record<string, { total: number; tax: number }>>((acc, o) => {
          const date = o.order_datetime.split('T')[0]
          if (!acc[date]) acc[date] = { total: 0, tax: 0 }
          acc[date].total += Number(o.gross_amount ?? 0)
          acc[date].tax   += Number(o.tax_amount ?? 0)
          return acc
        }, {})

        let pushed = 0
        for (const [date, sums] of Object.entries(byDate)) {
          const invoicePayload = {
            Invoices: [{
              Type: 'ACCREC',
              Contact: { Name: 'Daily Sales Summary' },
              Date: date,
              DueDate: date,
              Status: 'AUTHORISED',
              LineAmountTypes: 'Exclusive',
              LineItems: [{
                Description: `Sales — ${date}`,
                Quantity: 1,
                UnitAmount: sums.total - sums.tax,
                TaxAmount: sums.tax,
                AccountCode: '200', // Revenue account — from xero_account_mappings if available
              }],
            }],
          }

          const r = await xeroFetch('Invoices', {
            method: 'PUT',
            body: JSON.stringify(invoicePayload),
          })

          if (r.ok) pushed++
          else errors.push(`Sales ${date}: ${await r.text()}`)
        }
        results.sales = pushed
      } else {
        results.sales = 0
      }
    } catch (err) {
      errors.push(`Sales sync error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── SYNC: Purchase Orders → Xero Bills ───────────────────────────
  if (syncTypes.includes('purchases')) {
    try {
      const poQuery = db
        .from('purchase_orders')
        .select('id, created_at, supplier_id, total_amount, status, suppliers(name)')
        .eq('org_id', orgId)
        .in('status', ['approved', 'received'])
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59')

      if (venueId) poQuery.eq('venue_id', venueId)

      const { data: pos } = await poQuery

      if (pos && pos.length > 0) {
        let pushed = 0
        for (const po of pos) {
          const rawSupplier = po.suppliers as unknown
          const supplierName = (Array.isArray(rawSupplier) ? (rawSupplier[0] as { name: string })?.name : (rawSupplier as { name: string } | null)?.name) ?? 'Supplier'
          const billPayload = {
            Invoices: [{
              Type: 'ACCPAY',
              Contact: { Name: supplierName },
              Date: po.created_at.split('T')[0],
              DueDate: po.created_at.split('T')[0],
              Status: 'AUTHORISED',
              LineAmountTypes: 'Inclusive',
              LineItems: [{
                Description: `Purchase Order ${po.id.slice(0, 8)}`,
                Quantity: 1,
                UnitAmount: Number(po.total_amount ?? 0),
                AccountCode: '310', // COGS — from xero_account_mappings if available
              }],
            }],
          }

          const r = await xeroFetch('Invoices', {
            method: 'PUT',
            body: JSON.stringify(billPayload),
          })

          if (r.ok) pushed++
          else errors.push(`PO ${po.id.slice(0, 8)}: ${await r.text()}`)
        }
        results.purchases = pushed
      } else {
        results.purchases = 0
      }
    } catch (err) {
      errors.push(`Purchases sync error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── SYNC: Payroll Journals → Xero ────────────────────────────────
  if (syncTypes.includes('payroll')) {
    try {
      const tsQuery = db
        .from('timesheets')
        .select('id, period_start, period_end, gross_pay, staff_id')
        .eq('org_id', orgId)
        .eq('status', 'approved')
        .gte('period_start', dateFrom)
        .lte('period_start', dateTo)

      if (venueId) tsQuery.eq('venue_id', venueId)

      const { data: timesheets } = await tsQuery

      if (timesheets && timesheets.length > 0) {
        const totalWages = timesheets.reduce((s, t) => s + Number(t.gross_pay ?? 0), 0)
        const journalPayload = {
          ManualJournals: [{
            Narration: `Payroll — ${dateFrom} to ${dateTo}`,
            Date: dateTo,
            Status: 'POSTED',
            JournalLines: [
              {
                LineAmount: -totalWages,
                AccountCode: '477',
                Description: 'Wages and Salaries',
              },
              {
                LineAmount: totalWages,
                AccountCode: '800',
                Description: 'Wages Payable',
              },
            ],
          }],
        }

        const r = await xeroFetch('ManualJournals', {
          method: 'PUT',
          body: JSON.stringify(journalPayload),
        })

        if (r.ok) results.payroll = timesheets.length
        else errors.push(`Payroll journal: ${await r.text()}`)
      } else {
        results.payroll = 0
      }
    } catch (err) {
      errors.push(`Payroll sync error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Determine overall status and update log ─────────────────────
  const totalPushed = Object.values(results).reduce((s, n) => s + n, 0)
  const syncStatus  = errors.length === 0 ? 'success'
    : totalPushed > 0 ? 'partial' : 'error'
  const errorSummary = errors.join('; ')

  // Update sync log
  if (logRow) {
    await db
      .from('xero_sync_log' as 'pos_connections')
      .update({
        status: syncStatus,
        records_pushed: totalPushed,
        error_message: errorSummary || null,
        completed_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('id', logRow.id)
  }

  // Update connection last_sync
  await db
    .from('xero_connections' as 'pos_connections')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: syncStatus === 'success' ? 'success' : `error: ${errorSummary}`,
    } as Record<string, unknown>)
    .eq('id', conn.id)

  return res.status(200).json({
    success: syncStatus !== 'error',
    status: syncStatus,
    results,
    errors: errors.length > 0 ? errors : undefined,
  })
}
