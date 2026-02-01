/**
 * Format cents to currency string
 * @param cents Amount in cents
 * @returns Formatted currency string (e.g., "$12.50")
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
 * Parse currency string to cents
 */
export function parseCurrency(value: string): number {
  const numericValue = value.replace(/[^0-9.-]/g, '')
  return Math.round(parseFloat(numericValue) * 100)
}

export function formatPercentage(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}
