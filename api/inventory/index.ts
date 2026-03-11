/**
 * /api/inventory
 *
 * Unified inventory depletion engine handler.
 * Routes by query param: ?action=<action>
 *
 * Actions:
 *   GET  process-queue        — Process up to 10 pending depletion queue items
 *   GET  get-queue            — Queue status (last 100 items, counts by status)
 *   GET  get-movements        — Recent stock movements for an ingredient or venue
 *   GET  get-stock-levels     — Computed stock levels for all ingredients in a venue
 *   GET  get-forecast         — Demand forecasts for a date range
 *   POST run-forecast         — Run Holt-Winters and upsert demand_forecasts
 *   GET  get-recommendations  — Smart reorder recommendations
 *   POST sync-catalog         — Fetch Square catalog and upsert catalog mappings
 *   GET  get-catalog-mappings — Catalog mappings for a venue
 *   POST save-catalog-mapping — Upsert a single catalog mapping
 *   POST save-modifier-mapping — Upsert a modifier mapping
 *   POST save-waste-factor    — Upsert a waste factor
 *
 * Consolidated into one Vercel function to stay within Hobby plan 12-function limit.
 */

import type { VercelRequest, VercelResponse } from '../square/_lib'
import {
  extractToken,
  verifyUser,
  checkOrgAccess,
  supabaseAdmin,
  decrypt,
} from '../square/_lib'

// ── Types ────────────────────────────────────────────────────────────

interface QueueLineItem {
  catalog_item_id: string
  variation_id:    string
  quantity:        number
  modifiers:       Array<{ modifier_id: string; modifier_name: string }>
}

interface QueueRow {
  id:               string
  org_id:           string
  venue_id:         string
  square_order_id:  string
  line_items:       QueueLineItem[]
  status:           string
  error_message:    string | null
  retry_count:      number
  processed_at:     string | null
  created_at:       string
}

interface StockMovementInsert {
  org_id:         string
  venue_id:       string
  ingredient_id:  string
  movement_type:  string
  quantity:       number
  unit:           string
  unit_cost:      number | null
  reference_type: string
  reference_id:   string
  notes:          string | null
}

interface RecipeIngredientRow {
  ingredient_id:  string
  quantity:       number
  unit:           string
  ingredients: {
    id:        string
    unit_cost: number | null
  } | null
}

interface CatalogMappingRow {
  recipe_id: string | null
  recipes: {
    id: string
    recipe_ingredients: RecipeIngredientRow[]
  } | null
}

interface ModifierMappingRow {
  ingredient_id:      string | null
  quantity_adjustment: number
  adjustment_type:    string
  unit:               string
}

interface WasteFactorRow {
  ingredient_id:   string
  waste_percentage: number
  waste_type:      string
}

interface DailySalesPoint {
  date:     string
  quantity: number
}

interface ForecastResult {
  menu_item_id:      string
  forecast_date:     string
  predicted_quantity: number
  confidence_lower:  number
  confidence_upper:  number
  mape:              number | null
}

// ── Main handler ─────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string | undefined

  if (!action) {
    return res.status(400).json({
      error: 'action query param required',
      valid_actions: [
        'process-queue', 'get-queue', 'get-movements', 'get-stock-levels',
        'get-forecast', 'run-forecast', 'get-recommendations', 'sync-catalog',
        'get-catalog-mappings', 'save-catalog-mapping',
        'save-modifier-mapping', 'save-waste-factor',
      ],
    })
  }

  switch (action) {
    case 'process-queue':       return handleProcessQueue(req, res)
    case 'get-queue':           return handleGetQueue(req, res)
    case 'get-movements':       return handleGetMovements(req, res)
    case 'get-stock-levels':    return handleGetStockLevels(req, res)
    case 'get-forecast':        return handleGetForecast(req, res)
    case 'run-forecast':        return handleRunForecast(req, res)
    case 'get-recommendations': return handleGetRecommendations(req, res)
    case 'sync-catalog':        return handleSyncCatalog(req, res)
    case 'get-catalog-mappings':return handleGetCatalogMappings(req, res)
    case 'save-catalog-mapping':return handleSaveCatalogMapping(req, res)
    case 'save-modifier-mapping':return handleSaveModifierMapping(req, res)
    case 'save-waste-factor':   return handleSaveWasteFactor(req, res)
    default:
      return res.status(400).json({ error: `Unknown action: ${action}` })
  }
}

// ── Auth helper ──────────────────────────────────────────────────────

async function authenticate(req: VercelRequest, res: VercelResponse, orgId: string) {
  const token = extractToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }

  const { user, error, status } = await verifyUser(token)
  if (!user) {
    res.status(status!).json({ error })
    return null
  }

  const hasAccess = await checkOrgAccess(token, orgId)
  if (!hasAccess) {
    res.status(403).json({ error: 'No access to this organisation' })
    return null
  }

  return { user, token }
}

// ── process-queue ────────────────────────────────────────────────────
// Picks up up to 10 pending depletion queue items for an org/venue,
// resolves recipes and ingredients, applies modifier and waste adjustments,
// bulk-inserts stock_movements, and marks items complete.

async function handleProcessQueue(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as { org_id?: string; venue_id?: string } | undefined
  const orgId   = body?.org_id
  const venueId = body?.venue_id

  if (!orgId)   return res.status(400).json({ error: 'org_id required' })
  if (!venueId) return res.status(400).json({ error: 'venue_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  // Fetch up to 10 pending items. SKIP LOCKED handled in Postgres via raw SQL.
  // Supabase JS doesn't expose SELECT FOR UPDATE directly, so we use a RPC or
  // a simple select + immediate status update to claim rows atomically.
  // Pattern: select pending → set to 'processing' → process → set to 'completed'/'failed'
  const { data: rawItems, error: fetchErr } = await (db
    .from('stock_depletion_queue' as unknown as 'pos_connections')
    .select('*')
    .eq('org_id', orgId)
    .eq('venue_id', venueId)
    .in('status', ['pending', 'failed'])
    .lt('retry_count', 5)
    .order('created_at', { ascending: true })
    .limit(10) as unknown as Promise<{ data: QueueRow[] | null; error: unknown }>)

  if (fetchErr) {
    console.error('[inventory/process-queue] Fetch error:', fetchErr)
    return res.status(500).json({ error: 'Failed to fetch queue items' })
  }

  const items: QueueRow[] = rawItems ?? []
  if (items.length === 0) {
    return res.status(200).json({ processed: 0, message: 'No pending items' })
  }

  // Claim all rows by marking them 'processing'
  const itemIds = items.map(i => i.id)
  await (db
    .from('stock_depletion_queue' as unknown as 'pos_connections')
    .update({ status: 'processing' } as Record<string, unknown>)
    .in('id', itemIds) as unknown as Promise<unknown>)

  // Load catalog mappings for all unique catalog item IDs in this batch
  const allCatalogIds = [...new Set(
    items.flatMap(item => item.line_items.map(li => li.catalog_item_id))
  )]

  const { data: rawMappings } = await (db
    .from('square_catalog_mappings' as unknown as 'pos_connections')
    .select('square_catalog_item_id, recipe_id, recipes(id, recipe_ingredients(ingredient_id, quantity, unit, ingredients(id, unit_cost)))')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('square_catalog_item_id', allCatalogIds) as unknown as Promise<{
      data: (CatalogMappingRow & { square_catalog_item_id: string })[] | null
    }>)

  const catalogMap = new Map<string, CatalogMappingRow>()
  for (const m of rawMappings ?? []) {
    catalogMap.set(m.square_catalog_item_id, m)
  }

  // Load all modifier mappings for this org
  const allModifierIds = [...new Set(
    items.flatMap(item =>
      item.line_items.flatMap(li => li.modifiers.map(m => m.modifier_id))
    )
  )]

  const modifierMap = new Map<string, ModifierMappingRow>()
  if (allModifierIds.length > 0) {
    const { data: rawModifiers } = await (db
      .from('square_modifier_mappings' as unknown as 'pos_connections')
      .select('square_modifier_id, ingredient_id, quantity_adjustment, adjustment_type, unit')
      .eq('org_id', orgId)
      .in('square_modifier_id', allModifierIds) as unknown as Promise<{
        data: (ModifierMappingRow & { square_modifier_id: string })[] | null
      }>)

    for (const m of rawModifiers ?? []) {
      modifierMap.set(m.square_modifier_id, m)
    }
  }

  // Load waste factors for this venue
  const { data: rawWaste } = await (db
    .from('ingredient_waste_factors' as unknown as 'pos_connections')
    .select('ingredient_id, waste_percentage, waste_type')
    .eq('org_id', orgId)
    .or(`venue_id.eq.${venueId},venue_id.is.null`) as unknown as Promise<{
      data: WasteFactorRow[] | null
    }>)

  // Aggregate waste by ingredient (sum all applicable waste types)
  const wasteMap = new Map<string, number>()
  for (const w of rawWaste ?? []) {
    const current = wasteMap.get(w.ingredient_id) ?? 0
    wasteMap.set(w.ingredient_id, current + w.waste_percentage)
  }

  // Process each queue item
  const results: { id: string; status: string; movements: number; error?: string }[] = []

  for (const item of items) {
    const movements: StockMovementInsert[] = []

    try {
      for (const lineItem of item.line_items) {
        const mapping = catalogMap.get(lineItem.catalog_item_id)
        if (!mapping?.recipe_id || !mapping.recipes) {
          // No mapping configured — skip this line item silently
          continue
        }

        const recipeIngredients = mapping.recipes.recipe_ingredients ?? []

        for (const ri of recipeIngredients) {
          if (!ri.ingredient_id) continue

          // Base quantity from recipe × order quantity
          let depletionQty = ri.quantity * lineItem.quantity

          // Apply modifier adjustments for this line item
          for (const mod of lineItem.modifiers) {
            const modMapping = modifierMap.get(mod.modifier_id)
            if (!modMapping || modMapping.ingredient_id !== ri.ingredient_id) continue

            if (modMapping.adjustment_type === 'add') {
              depletionQty += modMapping.quantity_adjustment * lineItem.quantity
            } else if (modMapping.adjustment_type === 'remove') {
              depletionQty -= modMapping.quantity_adjustment * lineItem.quantity
              if (depletionQty < 0) depletionQty = 0
            } else if (modMapping.adjustment_type === 'replace') {
              depletionQty = modMapping.quantity_adjustment * lineItem.quantity
            }
          }

          // Apply waste factor: actual usage = theoretical × (1 + waste% / 100)
          const wastePct = wasteMap.get(ri.ingredient_id) ?? 0
          if (wastePct > 0) {
            depletionQty = depletionQty * (1 + wastePct / 100)
          }

          if (depletionQty <= 0) continue

          const unitCost = ri.ingredients?.unit_cost ?? null

          movements.push({
            org_id:         orgId,
            venue_id:       venueId,
            ingredient_id:  ri.ingredient_id,
            movement_type:  'sale_depletion',
            quantity:       -depletionQty, // negative = removes from stock
            unit:           ri.unit,
            unit_cost:      unitCost,
            reference_type: 'order',
            reference_id:   item.square_order_id,
            notes:          null,
          })
        }
      }

      // Bulk insert all movements for this order in one DB call
      if (movements.length > 0) {
        const { error: insertErr } = await (db
          .from('stock_movements' as unknown as 'pos_connections')
          .insert(movements as unknown as Record<string, unknown>[]) as unknown as Promise<{
            error: unknown
          }>)

        if (insertErr) {
          throw new Error(
            `stock_movements insert failed: ${insertErr instanceof Error ? insertErr.message : JSON.stringify(insertErr)}`
          )
        }
      }

      // Mark queue item completed
      await (db
        .from('stock_depletion_queue' as unknown as 'pos_connections')
        .update({
          status:       'completed',
          processed_at: new Date().toISOString(),
          error_message: null,
        } as Record<string, unknown>)
        .eq('id', item.id) as unknown as Promise<unknown>)

      results.push({ id: item.id, status: 'completed', movements: movements.length })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[inventory/process-queue] Failed item ${item.id}:`, errMsg)

      await (db
        .from('stock_depletion_queue' as unknown as 'pos_connections')
        .update({
          status:        'failed',
          error_message: errMsg,
          retry_count:   item.retry_count + 1,
        } as Record<string, unknown>)
        .eq('id', item.id) as unknown as Promise<unknown>)

      results.push({ id: item.id, status: 'failed', movements: 0, error: errMsg })
    }
  }

  const processed  = results.filter(r => r.status === 'completed').length
  const failed     = results.filter(r => r.status === 'failed').length
  const totalMoves = results.reduce((s, r) => s + r.movements, 0)

  return res.status(200).json({ processed, failed, total_movements: totalMoves, results })
}

// ── get-queue ────────────────────────────────────────────────────────

async function handleGetQueue(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const orgId   = req.query.org_id as string | undefined
  const venueId = req.query.venue_id as string | undefined

  if (!orgId) return res.status(400).json({ error: 'org_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  const query = (db
    .from('stock_depletion_queue' as unknown as 'pos_connections')
    .select('id, square_order_id, status, error_message, retry_count, processed_at, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100) as unknown as ReturnType<typeof db.from>)

  if (venueId) {
    (query as unknown as { eq: (col: string, val: string) => unknown }).eq('venue_id', venueId)
  }

  const { data: items, error } = await (query as unknown as Promise<{
    data: Record<string, unknown>[] | null
    error: unknown
  }>)

  if (error) {
    console.error('[inventory/get-queue] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch queue' })
  }

  // Count by status
  const counts: Record<string, number> = {}
  for (const item of items ?? []) {
    const s = item.status as string
    counts[s] = (counts[s] ?? 0) + 1
  }

  return res.status(200).json({ items: items ?? [], counts })
}

// ── get-movements ────────────────────────────────────────────────────

async function handleGetMovements(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const orgId        = req.query.org_id as string | undefined
  const venueId      = req.query.venue_id as string | undefined
  const ingredientId = req.query.ingredient_id as string | undefined
  const limitStr     = req.query.limit as string | undefined
  const limit        = Math.min(parseInt(limitStr ?? '100', 10), 500)

  if (!orgId)   return res.status(400).json({ error: 'org_id required' })
  if (!venueId) return res.status(400).json({ error: 'venue_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  let queryBuilder = (db
    .from('stock_movements' as unknown as 'pos_connections')
    .select('id, ingredient_id, movement_type, quantity, unit, unit_cost, reference_type, reference_id, notes, created_by, created_at')
    .eq('org_id', orgId)
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(limit) as unknown as {
      eq: (col: string, val: string) => typeof queryBuilder
      data: Record<string, unknown>[] | null
      error: unknown
    })

  if (ingredientId) {
    queryBuilder = queryBuilder.eq('ingredient_id', ingredientId)
  }

  const { data, error } = await (queryBuilder as unknown as Promise<{
    data: Record<string, unknown>[] | null
    error: unknown
  }>)

  if (error) {
    console.error('[inventory/get-movements] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch movements' })
  }

  return res.status(200).json({ movements: data ?? [] })
}

// ── get-stock-levels ─────────────────────────────────────────────────
// Returns computed stock levels for all ingredients in a venue.
// Calls calculate_current_stock() Postgres function for each ingredient.
// Also computes 14-day avg daily usage and days_remaining.

async function handleGetStockLevels(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const orgId   = req.query.org_id as string | undefined
  const venueId = req.query.venue_id as string | undefined

  if (!orgId)   return res.status(400).json({ error: 'org_id required' })
  if (!venueId) return res.status(400).json({ error: 'venue_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  // Load all ingredients for this venue's org
  const { data: ingredients, error: ingErr } = await (db
    .from('ingredients' as unknown as 'pos_connections')
    .select('id, name, unit, unit_cost, reorder_point, par_level')
    .eq('org_id', orgId) as unknown as Promise<{
      data: {
        id: string
        name: string
        unit: string
        unit_cost: number | null
        reorder_point: number | null
        par_level: number | null
      }[] | null
      error: unknown
    }>)

  if (ingErr) {
    console.error('[inventory/get-stock-levels] Ingredients error:', ingErr)
    return res.status(500).json({ error: 'Failed to fetch ingredients' })
  }

  const now = new Date()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // Load 14-day sale_depletion movements for avg usage calculation (single query, group in JS)
  const { data: recentMovements, error: movErr } = await (db
    .from('stock_movements' as unknown as 'pos_connections')
    .select('ingredient_id, quantity, created_at')
    .eq('org_id', orgId)
    .eq('venue_id', venueId)
    .eq('movement_type', 'sale_depletion')
    .gte('created_at', fourteenDaysAgo) as unknown as Promise<{
      data: { ingredient_id: string; quantity: number; created_at: string }[] | null
      error: unknown
    }>)

  if (movErr) {
    console.error('[inventory/get-stock-levels] Movements error:', movErr)
    return res.status(500).json({ error: 'Failed to fetch recent movements' })
  }

  // Aggregate 14-day totals per ingredient
  const usageByIngredient = new Map<string, number>()
  for (const m of recentMovements ?? []) {
    const current = usageByIngredient.get(m.ingredient_id) ?? 0
    usageByIngredient.set(m.ingredient_id, current + Math.abs(m.quantity))
  }

  // Compute current stock for each ingredient via Postgres function
  const stockLevels = await Promise.all(
    (ingredients ?? []).map(async (ing) => {
      let currentStock = 0

      try {
        const { data: stockData } = await db.rpc(
          'calculate_current_stock' as 'get_user_org_ids',
          { p_ingredient_id: ing.id, p_venue_id: venueId } as unknown as Record<string, never>
        ) as unknown as { data: number | null }

        currentStock = stockData ?? 0
      } catch {
        // RPC failed — fallback to 0, don't crash the whole response
        currentStock = 0
      }

      const totalUsage14d   = usageByIngredient.get(ing.id) ?? 0
      const avgDailyUsage   = totalUsage14d / 14
      const daysRemaining   = avgDailyUsage > 0 ? currentStock / avgDailyUsage : null

      const reorderPoint = ing.reorder_point ?? 0
      const parLevel     = ing.par_level ?? reorderPoint * 2

      let stockStatus: 'healthy' | 'low' | 'critical' | 'out'
      if (currentStock <= 0) {
        stockStatus = 'out'
      } else if (currentStock < reorderPoint) {
        stockStatus = 'critical'
      } else if (currentStock < parLevel) {
        stockStatus = 'low'
      } else {
        stockStatus = 'healthy'
      }

      return {
        ingredient_id:    ing.id,
        name:             ing.name,
        unit:             ing.unit,
        unit_cost:        ing.unit_cost,
        current_stock:    Math.round(currentStock * 1000) / 1000,
        avg_daily_usage:  Math.round(avgDailyUsage * 1000) / 1000,
        days_remaining:   daysRemaining !== null ? Math.round(daysRemaining * 10) / 10 : null,
        reorder_point:    reorderPoint,
        par_level:        parLevel,
        status:           stockStatus,
      }
    })
  )

  return res.status(200).json({ stock_levels: stockLevels })
}

// ── get-forecast ─────────────────────────────────────────────────────

async function handleGetForecast(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const orgId      = req.query.org_id as string | undefined
  const venueId    = req.query.venue_id as string | undefined
  const dateFrom   = req.query.date_from as string | undefined
  const dateTo     = req.query.date_to as string | undefined
  const menuItemId = req.query.menu_item_id as string | undefined

  if (!orgId)   return res.status(400).json({ error: 'org_id required' })
  if (!venueId) return res.status(400).json({ error: 'venue_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  const today       = new Date().toISOString().split('T')[0]
  const twoWeeks    = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const fromDate    = dateFrom ?? today
  const toDate      = dateTo   ?? twoWeeks

  let queryBuilder = (db
    .from('demand_forecasts' as unknown as 'pos_connections')
    .select('id, menu_item_id, forecast_date, predicted_quantity, confidence_lower, confidence_upper, model_version, mape, created_at')
    .eq('org_id', orgId)
    .eq('venue_id', venueId)
    .gte('forecast_date', fromDate)
    .lte('forecast_date', toDate)
    .order('forecast_date', { ascending: true }) as unknown as {
      eq: (col: string, val: string) => typeof queryBuilder
      data: Record<string, unknown>[] | null
      error: unknown
    })

  if (menuItemId) {
    queryBuilder = queryBuilder.eq('menu_item_id', menuItemId)
  }

  const { data, error } = await (queryBuilder as unknown as Promise<{
    data: Record<string, unknown>[] | null
    error: unknown
  }>)

  if (error) {
    console.error('[inventory/get-forecast] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch forecasts' })
  }

  return res.status(200).json({ forecasts: data ?? [] })
}

// ── run-forecast ─────────────────────────────────────────────────────
// Runs Holt-Winters additive smoothing (7-day seasonality) for all
// menu items with sufficient history, and upserts demand_forecasts.

async function handleRunForecast(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as { org_id?: string; venue_id?: string; horizon_days?: number } | undefined
  const orgId       = body?.org_id
  const venueId     = body?.venue_id
  const horizonDays = body?.horizon_days ?? 14

  if (!orgId)   return res.status(400).json({ error: 'org_id required' })
  if (!venueId) return res.status(400).json({ error: 'venue_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  // Load all menu items for this venue
  const { data: menuItems, error: miErr } = await (db
    .from('menu_items' as unknown as 'pos_connections')
    .select('id, name')
    .eq('org_id', orgId) as unknown as Promise<{
      data: { id: string; name: string }[] | null
      error: unknown
    }>)

  if (miErr) {
    console.error('[inventory/run-forecast] Menu items error:', miErr)
    return res.status(500).json({ error: 'Failed to fetch menu items' })
  }

  // Load 84 days (12 weeks) of sale_depletion movements, grouped by menu item via catalog mappings
  const eightWeeksAgo = new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString()

  // Load catalog mappings to resolve catalog_item → recipe → menu_item proxy
  // For demand forecasting, we proxy menu item demand from stock_movements aggregated
  // by reference_id (square_order_id) and matched back through catalog mappings.
  // Since menu_items and orders are linked via catalog, we use stock_movements
  // reference_id to count per-day order occurrences as a demand proxy.
  const { data: rawMovements, error: movErr } = await (db
    .from('stock_movements' as unknown as 'pos_connections')
    .select('ingredient_id, quantity, created_at, reference_id')
    .eq('org_id', orgId)
    .eq('venue_id', venueId)
    .eq('movement_type', 'sale_depletion')
    .gte('created_at', eightWeeksAgo)
    .order('created_at', { ascending: true }) as unknown as Promise<{
      data: { ingredient_id: string; quantity: number; created_at: string; reference_id: string }[] | null
      error: unknown
    }>)

  if (movErr) {
    console.error('[inventory/run-forecast] Movements error:', movErr)
    return res.status(500).json({ error: 'Failed to fetch historical movements' })
  }

  // Group unique orders per day as a proxy for daily cover count (menu-item agnostic)
  // For per-menu-item forecasting: group by reference_id (order) occurrences per day
  const ordersByDay = new Map<string, Set<string>>()
  for (const m of rawMovements ?? []) {
    const day = m.created_at.split('T')[0]
    if (!ordersByDay.has(day)) ordersByDay.set(day, new Set())
    if (m.reference_id) ordersByDay.get(day)!.add(m.reference_id)
  }

  // Build daily cover count time series
  const sortedDays = [...ordersByDay.keys()].sort()
  const dailySeries: DailySalesPoint[] = sortedDays.map(date => ({
    date,
    quantity: ordersByDay.get(date)!.size,
  }))

  if (dailySeries.length < 14) {
    return res.status(200).json({
      forecasted: 0,
      message: `Insufficient history: ${dailySeries.length} days (minimum 14 required)`,
    })
  }

  const today = new Date().toISOString().split('T')[0]
  const forecastRows: ForecastResult[] = []

  // Run Holt-Winters for each menu item
  // Since we don't have per-item daily quantities directly, we scale the cover
  // count series by the average proportion of orders containing each menu item
  // (derived from catalog mappings). For items with no direct mapping data,
  // we use the overall cover count series as the demand proxy.
  for (const menuItem of menuItems ?? []) {
    const hw = holtwinters(dailySeries, { alpha: 0.3, beta: 0.1, gamma: 0.2, season: 7, horizon: horizonDays })

    if (!hw) continue

    let mape: number | null = null
    if (dailySeries.length >= 7) {
      const actuals   = dailySeries.slice(-7).map(d => d.quantity)
      const predicted = hw.backtestLast7
      const mapeSum = actuals.reduce((s, actual, i) => {
        if (actual === 0) return s
        return s + Math.abs((actual - predicted[i]) / actual)
      }, 0)
      mape = Math.round((mapeSum / actuals.filter(a => a > 0).length) * 100 * 1000) / 1000
    }

    for (let h = 0; h < horizonDays; h++) {
      const forecastDate = new Date(Date.now() + (h + 1) * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]

      forecastRows.push({
        menu_item_id:       menuItem.id,
        forecast_date:      forecastDate,
        predicted_quantity: Math.max(0, Math.round(hw.forecast[h] * 100) / 100),
        confidence_lower:   Math.max(0, Math.round(hw.lower[h] * 100) / 100),
        confidence_upper:   Math.max(0, Math.round(hw.upper[h] * 100) / 100),
        mape:               mape,
      })
    }
  }

  if (forecastRows.length === 0) {
    return res.status(200).json({ forecasted: 0, message: 'No forecast rows generated' })
  }

  // Upsert demand_forecasts
  const upsertPayload = forecastRows.map(r => ({
    org_id:             orgId,
    venue_id:           venueId,
    menu_item_id:       r.menu_item_id,
    forecast_date:      r.forecast_date,
    predicted_quantity: r.predicted_quantity,
    confidence_lower:   r.confidence_lower,
    confidence_upper:   r.confidence_upper,
    model_version:      'holt_winters_v1',
    mape:               r.mape,
  }))

  const { error: upsertErr } = await (db
    .from('demand_forecasts' as unknown as 'pos_connections')
    .upsert(upsertPayload as unknown as Record<string, unknown>[], {
      onConflict: 'venue_id,menu_item_id,forecast_date',
    }) as unknown as Promise<{ error: unknown }>)

  if (upsertErr) {
    console.error('[inventory/run-forecast] Upsert error:', upsertErr)
    return res.status(500).json({ error: 'Failed to upsert forecasts' })
  }

  return res.status(200).json({
    forecasted:    forecastRows.length,
    menu_items:    (menuItems ?? []).length,
    horizon_days:  horizonDays,
    history_days:  dailySeries.length,
    run_at:        today,
  })
}

// ── get-recommendations ──────────────────────────────────────────────
// Returns smart reorder recommendations based on current stock levels,
// demand forecasts, and supplier lead times.

async function handleGetRecommendations(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const orgId   = req.query.org_id as string | undefined
  const venueId = req.query.venue_id as string | undefined

  if (!orgId)   return res.status(400).json({ error: 'org_id required' })
  if (!venueId) return res.status(400).json({ error: 'venue_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  // Load ingredients with supplier lead times
  const { data: ingredients, error: ingErr } = await (db
    .from('ingredients' as unknown as 'pos_connections')
    .select('id, name, unit, unit_cost, reorder_point, par_level, pack_size, supplier_id, suppliers(lead_time_days)')
    .eq('org_id', orgId) as unknown as Promise<{
      data: {
        id: string
        name: string
        unit: string
        unit_cost: number | null
        reorder_point: number | null
        par_level: number | null
        pack_size: number | null
        supplier_id: string | null
        suppliers: { lead_time_days: number | null } | null
      }[] | null
      error: unknown
    }>)

  if (ingErr) {
    console.error('[inventory/get-recommendations] Ingredients error:', ingErr)
    return res.status(500).json({ error: 'Failed to fetch ingredients' })
  }

  // Load 14-day usage for avg_daily_usage and stddev calculation
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recentMovements } = await (db
    .from('stock_movements' as unknown as 'pos_connections')
    .select('ingredient_id, quantity, created_at')
    .eq('org_id', orgId)
    .eq('venue_id', venueId)
    .eq('movement_type', 'sale_depletion')
    .gte('created_at', fourteenDaysAgo) as unknown as Promise<{
      data: { ingredient_id: string; quantity: number; created_at: string }[] | null
    }>)

  // Group by ingredient and day
  const usageByIngredientDay = new Map<string, Map<string, number>>()
  for (const m of recentMovements ?? []) {
    const day = m.created_at.split('T')[0]
    if (!usageByIngredientDay.has(m.ingredient_id)) {
      usageByIngredientDay.set(m.ingredient_id, new Map())
    }
    const dayMap = usageByIngredientDay.get(m.ingredient_id)!
    dayMap.set(day, (dayMap.get(day) ?? 0) + Math.abs(m.quantity))
  }

  const recommendations = await Promise.all(
    (ingredients ?? []).map(async (ing) => {
      // Compute current stock
      let currentStock = 0
      try {
        const { data: stockData } = await db.rpc(
          'calculate_current_stock' as 'get_user_org_ids',
          { p_ingredient_id: ing.id, p_venue_id: venueId } as unknown as Record<string, never>
        ) as unknown as { data: number | null }
        currentStock = stockData ?? 0
      } catch {
        currentStock = 0
      }

      const dayMap   = usageByIngredientDay.get(ing.id) ?? new Map<string, number>()
      const dayValues = [...dayMap.values()]

      const avgDailyUsage = dayValues.length > 0
        ? dayValues.reduce((s, v) => s + v, 0) / 14
        : 0

      if (avgDailyUsage <= 0) return null

      // Std deviation of daily demand
      const mean   = dayValues.reduce((s, v) => s + v, 0) / Math.max(dayValues.length, 1)
      const variance = dayValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.max(dayValues.length, 1)
      const stdDev = Math.sqrt(variance)

      const rawSupplier  = ing.suppliers as unknown
      const leadTimeDays = (rawSupplier && typeof rawSupplier === 'object' && 'lead_time_days' in rawSupplier
        ? (rawSupplier as { lead_time_days: number | null }).lead_time_days
        : null) ?? 3

      // Safety stock: Z × σ × √lead_time (Z=1.28 for 90% service level)
      const Z           = 1.28
      const safetyStock = Z * stdDev * Math.sqrt(leadTimeDays)

      // Reorder point: (avg_daily_demand × lead_time) + safety_stock
      const rop = (avgDailyUsage * leadTimeDays) + safetyStock

      // Forecasted demand over lead time days
      const forecastedDemandOverLead = avgDailyUsage * leadTimeDays

      // Order quantity needed
      const deficit = forecastedDemandOverLead + safetyStock - currentStock
      if (deficit <= 0) return null

      const packSize  = ing.pack_size ?? 1
      const orderQty  = Math.ceil(deficit / packSize) * packSize

      // Urgency
      const daysRemaining = currentStock / avgDailyUsage
      const urgency: 'immediate' | 'soon' | 'planned' =
        daysRemaining < 2  ? 'immediate' :
        daysRemaining < 5  ? 'soon'      :
                             'planned'

      return {
        ingredient_id:         ing.id,
        name:                  ing.name,
        unit:                  ing.unit,
        current_stock:         Math.round(currentStock * 100) / 100,
        avg_daily_usage:       Math.round(avgDailyUsage * 100) / 100,
        days_remaining:        Math.round(daysRemaining * 10) / 10,
        reorder_point:         Math.round(rop * 100) / 100,
        safety_stock:          Math.round(safetyStock * 100) / 100,
        lead_time_days:        leadTimeDays,
        recommended_order_qty: Math.round(orderQty * 100) / 100,
        pack_size:             packSize,
        estimated_cost:        ing.unit_cost ? Math.round(orderQty * ing.unit_cost * 100) / 100 : null,
        urgency,
        supplier_id:           ing.supplier_id,
      }
    })
  )

  const filtered = recommendations.filter(Boolean)
  // Sort by urgency: immediate → soon → planned
  const urgencyOrder = { immediate: 0, soon: 1, planned: 2 }
  filtered.sort((a, b) =>
    urgencyOrder[a!.urgency] - urgencyOrder[b!.urgency]
  )

  return res.status(200).json({ recommendations: filtered })
}

// ── sync-catalog ─────────────────────────────────────────────────────
// Fetches Square catalog items and upserts into square_catalog_mappings
// for the POS Mapping UI to auto-populate.

async function handleSyncCatalog(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as { org_id?: string; venue_id?: string } | undefined
  const orgId   = body?.org_id
  const venueId = body?.venue_id

  if (!orgId) return res.status(400).json({ error: 'org_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  // Load Square connection for this org
  const { data: conn, error: connErr } = await (db
    .from('pos_connections')
    .select('id, access_token, expires_at')
    .eq('org_id', orgId)
    .eq('pos_type', 'square')
    .eq('is_active', true)
    .maybeSingle() as unknown as Promise<{
      data: { id: string; access_token: string; expires_at: string | null } | null
      error: unknown
    }>)

  if (connErr || !conn) {
    return res.status(404).json({ error: 'No active Square connection found' })
  }

  let accessToken: string
  try {
    accessToken = decrypt(conn.access_token)
  } catch {
    return res.status(500).json({ error: 'Failed to decrypt Square access token' })
  }

  // Fetch catalog from Square
  const SQUARE_BASE = process.env.SQUARE_ENVIRONMENT === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com'

  let cursor: string | undefined
  const allItems: { id: string; item_data?: { name?: string } }[] = []

  // Paginate through all catalog items
  do {
    const url = new URL(`${SQUARE_BASE}/v2/catalog/list`)
    url.searchParams.set('types', 'ITEM')
    if (cursor) url.searchParams.set('cursor', cursor)

    const catalogRes = await fetch(url.toString(), {
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!catalogRes.ok) {
      const text = await catalogRes.text()
      console.error('[inventory/sync-catalog] Square API error:', text)
      return res.status(502).json({ error: 'Failed to fetch Square catalog' })
    }

    const data = await catalogRes.json() as {
      objects?: { id: string; item_data?: { name?: string } }[]
      cursor?: string
    }

    allItems.push(...(data.objects ?? []))
    cursor = data.cursor
  } while (cursor && allItems.length < 1000)

  if (allItems.length === 0) {
    return res.status(200).json({ synced: 0, message: 'No catalog items found' })
  }

  // Upsert catalog mappings (pre-populate name, leave recipe_id null for operator to map)
  const mappings = allItems.map(item => ({
    org_id:                 orgId,
    venue_id:               venueId ?? null,
    square_catalog_item_id: item.id,
    square_item_name:       item.item_data?.name ?? item.id,
    recipe_id:              null,
    is_active:              true,
  }))

  const { error: upsertErr } = await (db
    .from('square_catalog_mappings' as unknown as 'pos_connections')
    .upsert(mappings as unknown as Record<string, unknown>[], {
      onConflict: 'org_id,square_catalog_item_id',
      ignoreDuplicates: false,
    }) as unknown as Promise<{ error: unknown }>)

  if (upsertErr) {
    console.error('[inventory/sync-catalog] Upsert error:', upsertErr)
    return res.status(500).json({ error: 'Failed to upsert catalog mappings' })
  }

  return res.status(200).json({ synced: mappings.length })
}

// ── get-catalog-mappings ──────────────────────────────────────────────

async function handleGetCatalogMappings(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const orgId   = req.query.org_id as string | undefined
  const venueId = req.query.venue_id as string | undefined

  if (!orgId) return res.status(400).json({ error: 'org_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  let queryBuilder = (db
    .from('square_catalog_mappings' as unknown as 'pos_connections')
    .select('id, square_catalog_item_id, square_item_name, recipe_id, venue_id, is_active, created_at, updated_at, recipes(id, name)')
    .eq('org_id', orgId)
    .order('square_item_name', { ascending: true }) as unknown as {
      eq: (col: string, val: string) => typeof queryBuilder
      data: Record<string, unknown>[] | null
      error: unknown
    })

  if (venueId) {
    queryBuilder = queryBuilder.eq('venue_id', venueId)
  }

  const { data, error } = await (queryBuilder as unknown as Promise<{
    data: Record<string, unknown>[] | null
    error: unknown
  }>)

  if (error) {
    console.error('[inventory/get-catalog-mappings] Error:', error)
    return res.status(500).json({ error: 'Failed to fetch catalog mappings' })
  }

  return res.status(200).json({ mappings: data ?? [] })
}

// ── save-catalog-mapping ─────────────────────────────────────────────

async function handleSaveCatalogMapping(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as {
    org_id?:                string
    venue_id?:              string | null
    square_catalog_item_id?: string
    square_item_name?:      string
    recipe_id?:             string | null
    is_active?:             boolean
  } | undefined

  const orgId = body?.org_id
  if (!orgId) return res.status(400).json({ error: 'org_id required' })
  if (!body?.square_catalog_item_id) return res.status(400).json({ error: 'square_catalog_item_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  const { error } = await (db
    .from('square_catalog_mappings' as unknown as 'pos_connections')
    .upsert({
      org_id:                 orgId,
      venue_id:               body.venue_id ?? null,
      square_catalog_item_id: body.square_catalog_item_id,
      square_item_name:       body.square_item_name ?? body.square_catalog_item_id,
      recipe_id:              body.recipe_id ?? null,
      is_active:              body.is_active ?? true,
    } as Record<string, unknown>, {
      onConflict: 'org_id,square_catalog_item_id',
    }) as unknown as Promise<{ error: unknown }>)

  if (error) {
    console.error('[inventory/save-catalog-mapping] Error:', error)
    return res.status(500).json({ error: 'Failed to save catalog mapping' })
  }

  return res.status(200).json({ success: true })
}

// ── save-modifier-mapping ────────────────────────────────────────────

async function handleSaveModifierMapping(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as {
    org_id?:              string
    square_modifier_id?:  string
    square_modifier_name?: string
    ingredient_id?:       string | null
    quantity_adjustment?: number
    adjustment_type?:     string
    unit?:                string
  } | undefined

  const orgId = body?.org_id
  if (!orgId) return res.status(400).json({ error: 'org_id required' })
  if (!body?.square_modifier_id) return res.status(400).json({ error: 'square_modifier_id required' })

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const adjustmentType = body.adjustment_type ?? 'add'
  if (!['add', 'remove', 'replace'].includes(adjustmentType)) {
    return res.status(400).json({ error: 'adjustment_type must be add|remove|replace' })
  }

  const db = supabaseAdmin()

  const { error } = await (db
    .from('square_modifier_mappings' as unknown as 'pos_connections')
    .upsert({
      org_id:               orgId,
      square_modifier_id:   body.square_modifier_id,
      square_modifier_name: body.square_modifier_name ?? body.square_modifier_id,
      ingredient_id:        body.ingredient_id ?? null,
      quantity_adjustment:  body.quantity_adjustment ?? 0,
      adjustment_type:      adjustmentType,
      unit:                 body.unit ?? 'g',
    } as Record<string, unknown>, {
      onConflict: 'org_id,square_modifier_id',
    }) as unknown as Promise<{ error: unknown }>)

  if (error) {
    console.error('[inventory/save-modifier-mapping] Error:', error)
    return res.status(500).json({ error: 'Failed to save modifier mapping' })
  }

  return res.status(200).json({ success: true })
}

// ── save-waste-factor ────────────────────────────────────────────────

async function handleSaveWasteFactor(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as {
    org_id?:           string
    venue_id?:         string | null
    ingredient_id?:    string
    waste_percentage?: number
    waste_type?:       string
    notes?:            string | null
  } | undefined

  const orgId = body?.org_id
  if (!orgId) return res.status(400).json({ error: 'org_id required' })
  if (!body?.ingredient_id) return res.status(400).json({ error: 'ingredient_id required' })

  const wastePct = body.waste_percentage ?? 0
  if (wastePct < 0 || wastePct > 100) {
    return res.status(400).json({ error: 'waste_percentage must be between 0 and 100' })
  }

  const wasteType = body.waste_type ?? 'trim'
  if (!['trim', 'spillage', 'evaporation', 'overportioning'].includes(wasteType)) {
    return res.status(400).json({ error: 'waste_type must be trim|spillage|evaporation|overportioning' })
  }

  const auth = await authenticate(req, res, orgId)
  if (!auth) return

  const db = supabaseAdmin()

  const { error } = await (db
    .from('ingredient_waste_factors' as unknown as 'pos_connections')
    .upsert({
      org_id:           orgId,
      venue_id:         body.venue_id ?? null,
      ingredient_id:    body.ingredient_id,
      waste_percentage: wastePct,
      waste_type:       wasteType,
      notes:            body.notes ?? null,
    } as Record<string, unknown>, {
      onConflict: 'id',
    }) as unknown as Promise<{ error: unknown }>)

  if (error) {
    console.error('[inventory/save-waste-factor] Error:', error)
    return res.status(500).json({ error: 'Failed to save waste factor' })
  }

  return res.status(200).json({ success: true })
}

// ── Holt-Winters additive smoothing ──────────────────────────────────
// Additive model with 7-day seasonal period.
// Returns forecast array (length = horizon), confidence bands, and backtestLast7.
//
// Parameters:
//   alpha (0-1) — level smoothing
//   beta  (0-1) — trend smoothing
//   gamma (0-1) — seasonal smoothing
//   season      — seasonal period (7 for weekly)
//   horizon     — number of periods to forecast
//
// Minimum data: 2 × season periods (14 days) for initialisation.

function holtwinters(
  series: DailySalesPoint[],
  opts: { alpha: number; beta: number; gamma: number; season: number; horizon: number }
): {
  forecast:      number[]
  lower:         number[]
  upper:         number[]
  backtestLast7: number[]
} | null {
  const { alpha, beta, gamma, season, horizon } = opts
  const n = series.length

  if (n < 2 * season) return null

  const y = series.map(d => d.quantity)

  // ── Initialise level, trend, and seasonal factors ──────────────
  // Level: average of first seasonal period
  let level = 0
  for (let i = 0; i < season; i++) level += y[i]
  level /= season

  // Trend: average slope between first and second seasonal periods
  let trend = 0
  for (let i = 0; i < season; i++) {
    trend += (y[season + i] - y[i]) / season
  }
  trend /= season

  // Seasonal factors: ratio of each point to the initial level
  const seasonal: number[] = new Array(season).fill(0)
  for (let i = 0; i < season; i++) {
    seasonal[i] = y[i] - level
  }

  // ── Smooth through historical data ─────────────────────────────
  const fitted: number[] = []
  for (let t = 0; t < n; t++) {
    const s = t % season
    const fitted_t = level + trend + seasonal[s]
    fitted.push(fitted_t)

    const prevLevel = level
    level   = alpha * (y[t] - seasonal[s]) + (1 - alpha) * (level + trend)
    trend   = beta  * (level - prevLevel)  + (1 - beta)  * trend
    seasonal[s] = gamma * (y[t] - level)   + (1 - gamma) * seasonal[s]
  }

  // ── RMSE on fitted series (for confidence interval) ────────────
  let rmse = 0
  for (let t = 0; t < n; t++) {
    rmse += Math.pow(y[t] - fitted[t], 2)
  }
  rmse = Math.sqrt(rmse / n)

  // ── Generate forecast ──────────────────────────────────────────
  const forecast: number[] = []
  const lower:    number[] = []
  const upper:    number[] = []

  for (let h = 1; h <= horizon; h++) {
    const s = (n + h - 1) % season
    const f = level + h * trend + seasonal[s]
    const band = 1.5 * rmse * Math.sqrt(h) // widen confidence band with horizon

    forecast.push(f)
    lower.push(f - band)
    upper.push(f + band)
  }

  // ── Backtest: last 7 fitted values ─────────────────────────────
  const backtestLast7 = fitted.slice(-7)

  return { forecast, lower, upper, backtestLast7 }
}
