import { format } from 'date-fns'

/**
 * Format cents to currency string (AUD)
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(cents / 100)
}

/**
 * Format cents to currency string without symbol
 */
export function formatCurrencyNoSymbol(cents: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/**
 * Format percentage with + or - sign
 */
export function formatPercentage(value: number | null, decimals: number = 1): string {
  if (value === null) return 'N/A'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Format number with thousands separators
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format date for display
 */
export function formatDate(date: Date, pattern: string = 'dd MMM yyyy'): string {
  return format(date, pattern)
}

/**
 * Format date range
 */
export function formatDateRange(start: Date, end: Date): string {
  if (format(start, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')) {
    return formatDate(start)
  }
  return `${formatDate(start)} - ${formatDate(end)}`
}

/**
 * Get variance color class
 */
export function getVarianceColor(variance: number | null, invertColors: boolean = false): string {
  if (variance === null) return 'text-muted-foreground'
  
  const isPositive = variance >= 0
  const isGood = invertColors ? !isPositive : isPositive
  
  if (Math.abs(variance) < 2) return 'text-muted-foreground'
  return isGood ? 'text-green-600' : 'text-red-600'
}

/**
 * Get severity badge color
 */
export function getSeverityColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high': return 'bg-red-100 text-red-800'
    case 'medium': return 'bg-amber-100 text-amber-800'
    case 'low': return 'bg-blue-100 text-blue-800'
  }
}
