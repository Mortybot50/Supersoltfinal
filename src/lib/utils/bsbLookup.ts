const BSB_MAP: Record<string, string> = {
  '062': 'Commonwealth Bank',
  '063': 'Commonwealth Bank',
  '064': 'Commonwealth Bank',
  '065': 'BankWest',
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
  '017': 'ANZ',
  '083': 'NAB',
  '084': 'NAB',
  '085': 'NAB',
  '086': 'NAB',
  '087': 'NAB',
  '182': 'Bank of Queensland',
  '124': 'Bendigo Bank',
  '633': 'Bendigo Bank',
  '923': 'ING Bank',
  '814': 'Macquarie Bank',
  '484': 'St George Bank',
  '732': 'AMP Bank',
  '802': 'Suncorp Bank'
}

export function validateBSB(bsb: string): boolean {
  const cleaned = bsb.replace(/[\s-]/g, '')
  return /^\d{6}$/.test(cleaned)
}

export function lookupBank(bsb: string): { bank: string } | null {
  const cleaned = bsb.replace(/[\s-]/g, '')
  const prefix = cleaned.substring(0, 3)
  const bank = BSB_MAP[prefix]
  return bank ? { bank } : null
}

export function formatBSB(bsb: string): string {
  const cleaned = bsb.replace(/[\s-]/g, '')
  if (cleaned.length === 6) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`
  }
  return bsb
}
