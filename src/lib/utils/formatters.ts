/**
 * Currency formatting (cents to AUD display)
 */
export function formatCurrency(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || isNaN(cents)) return '$0.00'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(cents / 100)
}

/**
 * Currency without symbol
 */
export function formatCurrencyNoSymbol(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || isNaN(cents)) return '0.00'
  return new Intl.NumberFormat('en-AU', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(cents / 100)
}

/**
 * Date formatting
 */
export function formatDate(date: Date | string | null | undefined, formatType: 'short' | 'long' = 'long'): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  
  if (formatType === 'short') {
    return new Intl.DateTimeFormat('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d)
  }
  
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d)
}

/**
 * Percentage formatting
 */
export function formatPercentage(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '0%'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Number formatting with thousands separator
 */
export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined) return '0'
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}
