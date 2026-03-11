/**
 * Client-side depletion engine service.
 * Calls /api/inventory API endpoints and reads from Supabase.
 * All mutations go through the API (which uses service role key for atomic operations).
 */

import { supabase } from '@/integrations/supabase/client'
import type { DepletionQueueItem, StockMovement, StockLevel } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

async function getAuthToken(): Promise<string | undefined> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token
}

function dbError(err: unknown): string {
  if (!err) return 'Unknown error'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>
    return (e.message as string) || (e.details as string) || (e.hint as string) || JSON.stringify(err)
  }
  return String(err)
}

// ---------------------------------------------------------------------------
// Enqueue an order for depletion processing (called after Square sync)
// ---------------------------------------------------------------------------

export async function enqueueOrderForDepletion(params: {
  orgId: string
  venueId: string
  squareOrderId: string
  lineItems: Array<{
    catalog_item_id: string
    variation_id?: string
    quantity: number
    modifiers?: Array<{ modifier_id: string; modifier_name: string }>
  }>
}): Promise<void> {
  const { orgId, venueId, squareOrderId, lineItems } = params

  const { error } = await supabase.from('stock_depletion_queue').insert({
    org_id: orgId,
    venue_id: venueId,
    square_order_id: squareOrderId,
    line_items: lineItems,
    status: 'pending',
    created_at: new Date().toISOString(),
  })

  if (error) throw new Error(`Failed to enqueue order for depletion: ${dbError(error)}`)
}

// ---------------------------------------------------------------------------
// Trigger processing of pending queue items
// ---------------------------------------------------------------------------

export async function processDepletionQueue(
  orgId: string,
  venueId: string
): Promise<{ processed: number; failed: number; skipped: number }> {
  const token = await getAuthToken()

  const res = await fetch(`${getBaseUrl()}/api/inventory?action=process-queue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ org_id: orgId, venue_id: venueId }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`processDepletionQueue failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as { processed: number; failed: number; skipped: number }
  return data
}

// ---------------------------------------------------------------------------
// Fetch depletion queue status
// ---------------------------------------------------------------------------

export async function getDepletionQueueStatus(
  orgId: string,
  venueId: string
): Promise<{
  pending: number
  processing: number
  completed: number
  failed: number
  recentItems: DepletionQueueItem[]
}> {
  const token = await getAuthToken()
  const url = `${getBaseUrl()}/api/inventory?action=get-queue&org_id=${encodeURIComponent(orgId)}&venue_id=${encodeURIComponent(venueId)}`

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`getDepletionQueueStatus failed (${res.status}): ${body}`)
  }

  return res.json() as Promise<{
    pending: number
    processing: number
    completed: number
    failed: number
    recentItems: DepletionQueueItem[]
  }>
}

// ---------------------------------------------------------------------------
// Fetch stock movements for an ingredient
// ---------------------------------------------------------------------------

export async function getIngredientMovements(
  ingredientId: string,
  venueId: string,
  limit = 50
): Promise<StockMovement[]> {
  const token = await getAuthToken()
  const url =
    `${getBaseUrl()}/api/inventory?action=get-movements` +
    `&ingredient_id=${encodeURIComponent(ingredientId)}` +
    `&venue_id=${encodeURIComponent(venueId)}` +
    `&limit=${limit}`

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`getIngredientMovements failed (${res.status}): ${body}`)
  }

  return res.json() as Promise<StockMovement[]>
}

// ---------------------------------------------------------------------------
// Fetch computed stock levels for all ingredients in a venue
// ---------------------------------------------------------------------------

export async function getStockLevels(orgId: string, venueId: string): Promise<StockLevel[]> {
  const token = await getAuthToken()
  const url =
    `${getBaseUrl()}/api/inventory?action=get-stock-levels` +
    `&org_id=${encodeURIComponent(orgId)}` +
    `&venue_id=${encodeURIComponent(venueId)}`

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`getStockLevels failed (${res.status}): ${body}`)
  }

  return res.json() as Promise<StockLevel[]>
}

// ---------------------------------------------------------------------------
// Add a manual stock movement (e.g., waste log, manual adjustment)
// ---------------------------------------------------------------------------

export async function addStockMovement(movement: {
  orgId: string
  venueId: string
  ingredientId: string
  movementType: 'waste_log' | 'manual_adjustment' | 'opening_stock'
  quantity: number // positive = add, negative = remove
  unit: string
  unitCost?: number
  referenceType?: string
  referenceId?: string
  notes?: string
}): Promise<void> {
  const {
    orgId,
    venueId,
    ingredientId,
    movementType,
    quantity,
    unit,
    unitCost,
    referenceType,
    referenceId,
    notes,
  } = movement

  const { error } = await supabase.from('stock_movements').insert({
    org_id: orgId,
    venue_id: venueId,
    ingredient_id: ingredientId,
    movement_type: movementType,
    quantity,
    unit,
    unit_cost: unitCost ?? null,
    reference_type: referenceType ?? null,
    reference_id: referenceId ?? null,
    notes: notes ?? null,
    created_at: new Date().toISOString(),
  })

  if (error) throw new Error(`Failed to add stock movement: ${dbError(error)}`)
}

// ---------------------------------------------------------------------------
// Add purchase receipt movements (called from POReceiving)
// ---------------------------------------------------------------------------

export async function recordPurchaseReceipt(params: {
  orgId: string
  venueId: string
  purchaseOrderId: string
  items: Array<{
    ingredientId: string
    quantityReceived: number
    unit: string
    unitCost: number
  }>
}): Promise<void> {
  const { orgId, venueId, purchaseOrderId, items } = params

  if (items.length === 0) return

  const rows = items.map((item) => ({
    org_id: orgId,
    venue_id: venueId,
    ingredient_id: item.ingredientId,
    movement_type: 'purchase_receipt' as const,
    quantity: item.quantityReceived,
    unit: item.unit,
    unit_cost: item.unitCost,
    reference_type: 'purchase_order',
    reference_id: purchaseOrderId,
    created_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('stock_movements').insert(rows)

  if (error) throw new Error(`Failed to record purchase receipt: ${dbError(error)}`)
}
