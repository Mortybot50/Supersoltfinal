/**
 * Demand Forecasting Service — Holt-Winters Additive
 *
 * Model: Holt-Winters additive with 7-day seasonality
 * Accuracy-complexity tradeoff: Better than simple moving averages for hospitality
 * (handles weekly patterns like Saturday surge), simpler than full ARIMA.
 *
 * Min data: 14 days for basic forecast, 28+ for reliable seasonal detection.
 * Parameters: α=0.3 (level smoothing), β=0.1 (trend smoothing), γ=0.4 (seasonal smoothing)
 * These are sensible defaults — auto-tuning via MAPE minimization runs when ≥28 days available.
 */

import { supabase } from '@/integrations/supabase/client'
import type { DemandForecast } from '@/types'

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

// ---------------------------------------------------------------------------
// Pure Holt-Winters implementation
// ---------------------------------------------------------------------------

/**
 * Run Holt-Winters Additive Seasonal smoothing on a daily sales array.
 *
 * Equations:
 *   L_t = α(y_t - S_{t-m}) + (1-α)(L_{t-1} + T_{t-1})   [level]
 *   T_t = β(L_t - L_{t-1}) + (1-β)T_{t-1}                [trend]
 *   S_t = γ(y_t - L_t) + (1-γ)S_{t-m}                    [seasonal]
 *   ŷ_{t+h} = L_t + h·T_t + S_{t - m + ((h-1) mod m) + 1}
 *
 * Initialization:
 *   L_0 = mean of first season
 *   T_0 = (mean(season 2) - mean(season 1)) / m
 *   S_0..m-1 = y_i / L_0 - 1  (additive deviation from level for each day of first season)
 *
 * Confidence interval: ±1.28 × RMSE  (≈ 80% CI)
 */
export function computeHoltWinters(
  historicalSales: Array<{ date: string; quantity: number }>,
  forecastDays: number,
  options?: {
    alpha?: number
    beta?: number
    gamma?: number
    seasonLength?: number
  }
): Array<{ date: string; predicted: number; lower: number; upper: number }> {
  const m = options?.seasonLength ?? 7
  let alpha = options?.alpha ?? 0.3
  let beta = options?.beta ?? 0.1
  let gamma = options?.gamma ?? 0.4

  // Sort historical data chronologically
  const sorted = [...historicalSales].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  const y = sorted.map((d) => Math.max(0, d.quantity))
  const n = y.length

  if (n < m) {
    // Not enough data — return zeros with wide intervals
    const lastDate = sorted.length > 0 ? new Date(sorted[sorted.length - 1].date) : new Date()
    return Array.from({ length: forecastDays }, (_, i) => {
      const d = new Date(lastDate)
      d.setDate(d.getDate() + i + 1)
      return {
        date: d.toISOString().slice(0, 10),
        predicted: 0,
        lower: 0,
        upper: 0,
      }
    })
  }

  // Auto-tune α, β, γ via MAPE minimisation when ≥ 28 days available
  if (n >= 28) {
    const result = autoTuneParameters(y, m)
    alpha = result.alpha
    beta = result.beta
    gamma = result.gamma
  }

  // --- Initialisation ---
  // Level: mean of first season
  const firstSeason = y.slice(0, m)
  const secondSeason = y.slice(m, 2 * m)

  const meanFirst = firstSeason.reduce((s, v) => s + v, 0) / m
  const meanSecond = secondSeason.length === m
    ? secondSeason.reduce((s, v) => s + v, 0) / m
    : meanFirst

  let L = meanFirst
  let T = (meanSecond - meanFirst) / m

  // Seasonal indices: S_i = y_i - L  (additive)
  const S: number[] = firstSeason.map((v) => v - meanFirst)

  // --- Smoothing over historical data ---
  const fitted: number[] = []
  for (let t = 0; t < n; t++) {
    const sIdx = ((t % m) + m) % m
    const prevL = L
    L = alpha * (y[t] - S[sIdx]) + (1 - alpha) * (L + T)
    T = beta * (L - prevL) + (1 - beta) * T
    S[sIdx] = gamma * (y[t] - L) + (1 - gamma) * S[sIdx]
    fitted.push(L + S[sIdx])
  }

  // RMSE for confidence intervals
  const squaredErrors = fitted.map((f, i) => Math.pow(f - y[i], 2))
  const rmse = Math.sqrt(squaredErrors.reduce((s, e) => s + e, 0) / squaredErrors.length)

  // --- Forecast ---
  const lastDate = new Date(sorted[n - 1].date)
  return Array.from({ length: forecastDays }, (_, h) => {
    const hStep = h + 1
    const sIdx = ((n - 1 + hStep) % m + m) % m
    const raw = L + hStep * T + S[sIdx]
    const predicted = Math.max(0, Math.round(raw * 100) / 100)
    const halfWidth = 1.28 * rmse * Math.sqrt(hStep) // widen CI over horizon

    const d = new Date(lastDate)
    d.setDate(d.getDate() + hStep)

    return {
      date: d.toISOString().slice(0, 10),
      predicted,
      lower: Math.max(0, Math.round((predicted - halfWidth) * 100) / 100),
      upper: Math.max(0, Math.round((predicted + halfWidth) * 100) / 100),
    }
  })
}

// ---------------------------------------------------------------------------
// Auto-tune α, β, γ by minimising MAPE on the in-sample fit
// Searches a coarse grid (0.1 step) — fast enough for ≤ ~365 data points
// ---------------------------------------------------------------------------

function autoTuneParameters(
  y: number[],
  m: number
): { alpha: number; beta: number; gamma: number } {
  const candidates = [0.1, 0.2, 0.3, 0.4, 0.5]
  let bestMape = Infinity
  let best = { alpha: 0.3, beta: 0.1, gamma: 0.4 }

  for (const a of candidates) {
    for (const b of candidates) {
      for (const g of candidates) {
        const mape = inSampleMape(y, m, a, b, g)
        if (mape < bestMape) {
          bestMape = mape
          best = { alpha: a, beta: b, gamma: g }
        }
      }
    }
  }
  return best
}

function inSampleMape(y: number[], m: number, alpha: number, beta: number, gamma: number): number {
  const firstSeason = y.slice(0, m)
  const secondSeason = y.slice(m, 2 * m)
  const meanFirst = firstSeason.reduce((s, v) => s + v, 0) / m
  const meanSecond = secondSeason.length === m
    ? secondSeason.reduce((s, v) => s + v, 0) / m
    : meanFirst

  let L = meanFirst
  let T = (meanSecond - meanFirst) / m
  const S: number[] = firstSeason.map((v) => v - meanFirst)

  let errorSum = 0
  let count = 0
  for (let t = 0; t < y.length; t++) {
    const sIdx = ((t % m) + m) % m
    const fitted = L + S[sIdx]
    const prevL = L
    L = alpha * (y[t] - S[sIdx]) + (1 - alpha) * (L + T)
    T = beta * (L - prevL) + (1 - beta) * T
    S[sIdx] = gamma * (y[t] - L) + (1 - gamma) * S[sIdx]
    if (y[t] > 0) {
      errorSum += Math.abs(y[t] - fitted) / y[t]
      count++
    }
  }
  return count > 0 ? errorSum / count : Infinity
}

// ---------------------------------------------------------------------------
// Run server-side forecast (upserts demand_forecasts table)
// ---------------------------------------------------------------------------

export async function runForecast(
  orgId: string,
  venueId: string
): Promise<{ itemsForecasted: number; itemsSkipped: number; averageMape: number | null }> {
  const token = await getAuthToken()

  const res = await fetch(`${getBaseUrl()}/api/inventory?action=run-forecast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ org_id: orgId, venue_id: venueId }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`runForecast failed (${res.status}): ${body}`)
  }

  return res.json() as Promise<{
    itemsForecasted: number
    itemsSkipped: number
    averageMape: number | null
  }>
}

// ---------------------------------------------------------------------------
// Get demand forecasts for a date range
// ---------------------------------------------------------------------------

export async function getDemandForecasts(
  venueId: string,
  fromDate: string,
  toDate: string,
  menuItemId?: string
): Promise<DemandForecast[]> {
  let query = supabase
    .from('demand_forecasts')
    .select('*')
    .eq('venue_id', venueId)
    .gte('forecast_date', fromDate)
    .lte('forecast_date', toDate)
    .order('forecast_date', { ascending: true })

  if (menuItemId) {
    query = query.eq('menu_item_id', menuItemId)
  }

  const { data, error } = await query

  if (error) throw new Error(`Failed to fetch demand forecasts: ${error.message}`)
  return (data ?? []) as unknown as DemandForecast[]
}

// ---------------------------------------------------------------------------
// Get forecast accuracy metrics (MAPE per menu item)
// ---------------------------------------------------------------------------

export async function getForecastAccuracy(venueId: string): Promise<
  Array<{
    menuItemId: string
    menuItemName: string
    mape: number
    dataPoints: number
    lastForecastAt: string
  }>
> {
  const { data, error } = await supabase
    .from('demand_forecasts')
    .select('menu_item_id, menu_item_name, mape, created_at')
    .eq('venue_id', venueId)
    .not('mape', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch forecast accuracy: ${error.message}`)

  // Aggregate per menu item — latest mape + count
  const byItem = new Map<
    string,
    { menuItemName: string; mapes: number[]; lastForecastAt: string }
  >()

  for (const row of data ?? []) {
    const existing = byItem.get(row.menu_item_id as string)
    if (existing) {
      existing.mapes.push(row.mape as number)
    } else {
      byItem.set(row.menu_item_id as string, {
        menuItemName: (row.menu_item_name as string) ?? '',
        mapes: [row.mape as number],
        lastForecastAt: row.created_at as string,
      })
    }
  }

  return Array.from(byItem.entries()).map(([menuItemId, { menuItemName, mapes, lastForecastAt }]) => ({
    menuItemId,
    menuItemName,
    mape: Math.round((mapes.reduce((s, v) => s + v, 0) / mapes.length) * 100) / 100,
    dataPoints: mapes.length,
    lastForecastAt,
  }))
}
