const BSB_MAP: Record<string, string> = {
  '062': 'Commonwealth Bank',
  '063': 'Commonwealth Bank',
  '064': 'Commonwealth Bank',
  '065': 'Commonwealth Bank',
  '066': 'Commonwealth Bank',
  '032': 'Westpac',
  '033': 'Westpac',
  '034': 'Westpac',
  '035': 'Westpac',
  '036': 'Westpac',
  '037': 'Westpac',
  '038': 'Westpac',
  '013': 'ANZ',
  '014': 'ANZ',
  '015': 'ANZ',
  '016': 'ANZ',
  '083': 'NAB',
  '084': 'NAB',
  '085': 'NAB',
  '086': 'NAB',
  '633': 'Bendigo Bank',
  '634': 'Bendigo Bank',
  '923': 'ING',
  '733': 'Macquarie Bank',
  '484': 'St. George Bank',
  '485': 'St. George Bank',
  '112': 'Bank of Melbourne',
  '182': 'Bank SA',
}

export function validateBSB(bsb: string): boolean {
  const cleaned = bsb.replace(/[\s-]/g, '')
  return /^\d{6}$/.test(cleaned)
}

export function lookupBank(bsb: string): string | null {
  const cleaned = bsb.replace(/[\s-]/g, '')
  if (!validateBSB(cleaned)) return null
  
  const prefix = cleaned.substring(0, 3)
  return BSB_MAP[prefix] || 'Unknown Bank'
}

export function formatBSB(bsb: string): string {
  const cleaned = bsb.replace(/[\s-]/g, '')
  if (cleaned.length === 6) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`
  }
  return cleaned
}
