import * as XLSX from 'xlsx'
import { format } from 'date-fns'

export interface ParsedMenuItem {
  name: string
  category: string
  description?: string
  price: number // in cents
  gst: boolean
  available: boolean
}

export interface ParseError {
  row: number
  field: string
  message: string
}

export interface ParseWarning {
  row: number
  field: string
  message: string
}

export interface ParseResult {
  success: boolean
  data: ParsedMenuItem[]
  errors: ParseError[]
  warnings: ParseWarning[]
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
  }
}

const VALID_CATEGORIES = ['mains', 'sides', 'drinks', 'desserts', 'other']

export async function parseMenuItemsExcel(file: File): Promise<ParseResult> {
  const errors: ParseError[] = []
  const warnings: ParseWarning[] = []
  const validData: ParsedMenuItem[] = []
  
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    
    // Find MENU_ITEMS sheet (case insensitive)
    const sheetName = workbook.SheetNames.find(
      name => name.toLowerCase() === 'menu_items'
    )
    
    if (!sheetName) {
      errors.push({
        row: 0,
        field: 'sheet',
        message: 'No sheet named "MENU_ITEMS" found. Please use the template.'
      })
      
      return {
        success: false,
        data: [],
        errors,
        warnings,
        summary: { total_rows: 0, valid_rows: 0, invalid_rows: 0 }
      }
    }
    
    const worksheet = workbook.Sheets[sheetName]
    const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    
    if (rawData.length === 0) {
      errors.push({
        row: 0,
        field: 'sheet',
        message: 'Sheet is empty'
      })
      
      return {
        success: false,
        data: [],
        errors,
        warnings,
        summary: { total_rows: 0, valid_rows: 0, invalid_rows: 0 }
      }
    }
    
    rawData.forEach((row: any, index: number) => {
      const rowNumber = index + 2 // Excel is 1-indexed + header row
      const rowErrors: ParseError[] = []
      
      // Validate Item Name
      const name = String(row['Item Name'] || '').trim()
      if (!name) {
        rowErrors.push({
          row: rowNumber,
          field: 'Item Name',
          message: 'Item name is required'
        })
      } else if (name.length > 100) {
        rowErrors.push({
          row: rowNumber,
          field: 'Item Name',
          message: 'Item name must be less than 100 characters'
        })
      }
      
      // Validate Category
      const category = String(row['Category'] || '').trim().toLowerCase()
      if (!category) {
        rowErrors.push({
          row: rowNumber,
          field: 'Category',
          message: 'Category is required'
        })
      } else if (!VALID_CATEGORIES.includes(category)) {
        rowErrors.push({
          row: rowNumber,
          field: 'Category',
          message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`
        })
      }
      
      // Validate Price
      const priceStr = String(row['Price'] || '').replace(/[$,\s]/g, '')
      const price = parseFloat(priceStr)
      if (isNaN(price) || price <= 0) {
        rowErrors.push({
          row: rowNumber,
          field: 'Price',
          message: 'Price must be a positive number'
        })
      }
      
      // Parse GST (default to true)
      const gstStr = String(row['GST'] || 'yes').toLowerCase()
      const gst = ['yes', 'y', 'true', '1'].includes(gstStr)
      
      // Parse Available (default to true)
      const availableStr = String(row['Available'] || 'yes').toLowerCase()
      const available = ['yes', 'y', 'true', '1'].includes(availableStr)
      
      // Get optional description
      const description = String(row['Description'] || '').trim() || undefined
      
      if (rowErrors.length > 0) {
        errors.push(...rowErrors)
      } else {
        validData.push({
          name,
          category,
          description,
          price: Math.round(price * 100), // Convert to cents
          gst,
          available
        })
      }
    })
    
    return {
      success: errors.length === 0,
      data: validData,
      errors,
      warnings,
      summary: {
        total_rows: rawData.length,
        valid_rows: validData.length,
        invalid_rows: errors.length
      }
    }
    
  } catch (error: any) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, field: 'file', message: error.message }],
      warnings: [],
      summary: { total_rows: 0, valid_rows: 0, invalid_rows: 0 }
    }
  }
}

export function downloadMenuItemsTemplate() {
  const template = [
    {
      'Item Name': 'Margherita Pizza',
      'Category': 'Mains',
      'Description': '12" pizza with tomato, mozzarella, and basil',
      'Price': 18.50,
      'GST': 'Yes',
      'Available': 'Yes'
    },
    {
      'Item Name': 'House Salad',
      'Category': 'Sides',
      'Description': 'Mixed greens with balsamic vinaigrette',
      'Price': 9.00,
      'GST': 'Yes',
      'Available': 'Yes'
    },
    {
      'Item Name': 'Cappuccino',
      'Category': 'Drinks',
      'Description': 'Regular size',
      'Price': 4.50,
      'GST': 'Yes',
      'Available': 'Yes'
    },
    {
      'Item Name': 'Chocolate Brownie',
      'Category': 'Desserts',
      'Description': 'Warm brownie with vanilla ice cream',
      'Price': 8.00,
      'GST': 'Yes',
      'Available': 'Yes'
    }
  ]
  
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'MENU_ITEMS')
  XLSX.writeFile(wb, 'SuperSolt_MenuItems_Template.xlsx')
}
