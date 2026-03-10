// lib/currency.ts
export const DEFAULT_LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "en-AU"
export const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "AUD"

/**
 * Format a value as currency.
 * - If you store cents (e.g. 2800 => $28.00), pass { inCents: true }.
 * - Does NOT convert currencies; only formats with the AUD symbol.
 */
export function formatCurrency(
  value: number | null | undefined,
  opts?: { inCents?: boolean; maximumFractionDigits?: number }
) {
  if (value == null || Number.isNaN(value as number)) return "—"
  const amount = opts?.inCents ? (value as number) / 100 : (value as number)
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency: DEFAULT_CURRENCY,
    maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
  }).format(amount)
}
// lib/currency.ts
const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatAUD(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—"
  return AUD.format(Number(value))
}

// Useful for axis/tooltip where you don't want cents all the time:
export function formatAUDShort(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `A$${(value / 1_000_000).toFixed(1)}m`
  if (abs >= 1_000) return `A$${(value / 1_000).toFixed(1)}k`
  return AUD.format(value)
}
