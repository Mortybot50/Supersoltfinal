/**
 * CSV Import utilities for staff and ingredients.
 * Parses CSV text into typed arrays for bulk import.
 */

export interface StaffCSVRow {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  role: 'manager' | 'supervisor' | 'crew'
  employment_type: 'casual' | 'part_time' | 'full_time'
  base_hourly_rate: number
  award_classification?: string
  start_date?: string
}

export interface IngredientCSVRow {
  name: string
  category: string
  unit: string
  pack_size: number
  pack_unit: string
  pack_cost: number
  supplier_name?: string
  par_level?: number
  reorder_point?: number
  allergens?: string
}

/**
 * Parse CSV text into rows. Handles quoted fields and newlines within quotes.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"'
        i++ // skip next quote
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        row.push(current.trim())
        current = ''
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current.trim())
        if (row.some(cell => cell !== '')) rows.push(row)
        row = []
        current = ''
        if (ch === '\r') i++ // skip \n
      } else {
        current += ch
      }
    }
  }

  // Last row
  row.push(current.trim())
  if (row.some(cell => cell !== '')) rows.push(row)

  return rows
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

export interface CSVImportResult<T> {
  data: T[]
  errors: { row: number; message: string }[]
  warnings: { row: number; message: string }[]
}

export function parseStaffCSV(csvText: string): CSVImportResult<StaffCSVRow> {
  const rows = parseCSV(csvText)
  if (rows.length < 2) return { data: [], errors: [{ row: 0, message: 'CSV must have a header row and at least one data row' }], warnings: [] }

  const headers = rows[0].map(normalizeHeader)
  const data: StaffCSVRow[] = []
  const errors: { row: number; message: string }[] = []
  const warnings: { row: number; message: string }[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const get = (key: string) => {
      const idx = headers.indexOf(key)
      return idx >= 0 ? row[idx]?.trim() || '' : ''
    }

    const firstName = get('first_name') || get('firstname') || get('name')?.split(' ')[0] || ''
    const lastName = get('last_name') || get('lastname') || get('name')?.split(' ').slice(1).join(' ') || ''

    if (!firstName) {
      errors.push({ row: i + 1, message: 'Missing first name' })
      continue
    }

    const rateStr = get('base_hourly_rate') || get('hourly_rate') || get('rate') || get('pay_rate')
    const rate = parseFloat(rateStr)
    if (!rate || isNaN(rate)) {
      errors.push({ row: i + 1, message: `Invalid hourly rate: "${rateStr}" for ${firstName} ${lastName}` })
      continue
    }

    const empType = (get('employment_type') || get('type') || 'casual')
      .toLowerCase()
      .replace('-', '_')
      .replace('full time', 'full_time')
      .replace('part time', 'part_time') as StaffCSVRow['employment_type']

    const role = (get('role') || get('position') || 'crew')
      .toLowerCase() as StaffCSVRow['role']

    data.push({
      first_name: firstName,
      last_name: lastName,
      email: get('email') || undefined,
      phone: get('phone') || get('mobile') || undefined,
      role: ['manager', 'supervisor', 'crew'].includes(role) ? role : 'crew',
      employment_type: ['casual', 'part_time', 'full_time'].includes(empType) ? empType : 'casual',
      base_hourly_rate: rate,
      award_classification: get('award_classification') || get('award_level') || get('award') || undefined,
      start_date: get('start_date') || undefined,
    })
  }

  return { data, errors, warnings }
}

export function parseIngredientCSV(csvText: string): CSVImportResult<IngredientCSVRow> {
  const rows = parseCSV(csvText)
  if (rows.length < 2) return { data: [], errors: [{ row: 0, message: 'CSV must have a header row and at least one data row' }], warnings: [] }

  const headers = rows[0].map(normalizeHeader)
  const data: IngredientCSVRow[] = []
  const errors: { row: number; message: string }[] = []
  const warnings: { row: number; message: string }[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const get = (key: string) => {
      const idx = headers.indexOf(key)
      return idx >= 0 ? row[idx]?.trim() || '' : ''
    }

    const name = get('name') || get('ingredient') || get('item')
    if (!name) {
      errors.push({ row: i + 1, message: 'Missing ingredient name' })
      continue
    }

    const packCostStr = get('pack_cost') || get('cost') || get('price') || get('unit_cost')
    const packCost = parseFloat(packCostStr)
    if (!packCost || isNaN(packCost)) {
      warnings.push({ row: i + 1, message: `No cost for ${name} — will need to be entered later` })
    }

    const packSizeStr = get('pack_size') || get('size') || get('qty')
    const packSize = parseFloat(packSizeStr) || 1

    data.push({
      name,
      category: get('category') || get('type') || 'other',
      unit: get('unit') || get('base_unit') || 'kg',
      pack_size: packSize,
      pack_unit: get('pack_unit') || get('unit') || 'kg',
      pack_cost: packCost || 0,
      supplier_name: get('supplier') || get('supplier_name') || undefined,
      par_level: parseFloat(get('par_level') || get('par')) || undefined,
      reorder_point: parseFloat(get('reorder_point') || get('reorder') || get('min_stock')) || undefined,
      allergens: get('allergens') || get('allergy') || undefined,
    })
  }

  return { data, errors, warnings }
}

/**
 * Generate a CSV template string for download.
 */
export function generateStaffTemplate(): string {
  return `first_name,last_name,email,phone,role,employment_type,base_hourly_rate,award_classification,start_date
John,Smith,john@example.com,0412345678,crew,casual,28.26,Restaurant Industry Award L1,2024-01-15
Jane,Doe,,0498765432,supervisor,part_time,32.50,Restaurant Industry Award L2,2023-06-01`
}

export function generateIngredientTemplate(): string {
  return `name,category,unit,pack_size,pack_unit,pack_cost,supplier,par_level,reorder_point,allergens
Chicken Breast,protein,kg,5,kg,45.00,Metro Meats,20,10,
Sourdough Bread,bakery,loaf,1,loaf,6.50,Baker's Delight,15,8,gluten wheat
Mozzarella,dairy,kg,2,kg,22.00,Dairy Direct,10,5,dairy
Mixed Lettuce,produce,kg,1,kg,12.00,Fresh Fields,8,4,`
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
