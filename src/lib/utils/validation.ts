/**
 * Shared validation utilities for form fields
 */

/** Australian mobile phone: 04XX XXX XXX or +614XXXXXXXX */
export function isValidAUPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '')
  return /^(\+?61|0)4\d{8}$/.test(cleaned)
}

/** Format phone as 04XX XXX XXX */
export function formatAUPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '')
  const digits = cleaned.startsWith('+61') ? '0' + cleaned.slice(3) : cleaned
  if (digits.length !== 10) return phone
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
}

/** Valid email address */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** TFN: exactly 9 digits */
export function isValidTFN(tfn: string): boolean {
  const cleaned = tfn.replace(/\s/g, '')
  return /^\d{9}$/.test(cleaned)
}

/** BSB: exactly 6 digits */
export function isValidBSB(bsb: string): boolean {
  const cleaned = bsb.replace(/[\s\-]/g, '')
  return /^\d{6}$/.test(cleaned)
}

/** Bank account number: 6-10 digits */
export function isValidAccountNumber(acct: string): boolean {
  const cleaned = acct.replace(/[\s\-]/g, '')
  return /^\d{6,10}$/.test(cleaned)
}

/** AU postcode: exactly 4 digits */
export function isValidPostcode(postcode: string): boolean {
  return /^\d{4}$/.test(postcode.trim())
}

/** Positive monetary value (allows 0) */
export function isValidMoney(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0
}

/** Percentage 0-100 */
export function isValidPercentage(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0 && value <= 100
}
