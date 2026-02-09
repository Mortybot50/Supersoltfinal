import * as XLSX from 'xlsx'
import { parse, isValid } from 'date-fns'

export interface ParsedStaff {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: string
  hourlyRate: number // in cents
  startDate: string // ISO string
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
  data: ParsedStaff[]
  errors: ParseError[]
  warnings: ParseWarning[]
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
  }
}

const VALID_ROLES = ['manager', 'supervisor', 'kitchen', 'front of house', 'bar']

export async function parseStaffExcel(file: File): Promise<ParseResult> {
  const errors: ParseError[] = []
  const warnings: ParseWarning[] = []
  const validData: ParsedStaff[] = []
  const seenEmails = new Set<string>()
  
  try {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    
    // Find STAFF sheet (case insensitive)
    const sheetName = workbook.SheetNames.find(
      name => name.toLowerCase() === 'staff'
    )
    
    if (!sheetName) {
      errors.push({
        row: 0,
        field: 'sheet',
        message: 'No sheet named "STAFF" found. Please use the template.'
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
    
    rawData.forEach((row: Record<string, unknown>, index: number) => {
      const rowNumber = index + 2 // Excel is 1-indexed + header row
      const rowErrors: ParseError[] = []
      
      // Validate First Name
      const firstName = String(row['First Name'] || '').trim()
      if (!firstName) {
        rowErrors.push({
          row: rowNumber,
          field: 'First Name',
          message: 'First name is required'
        })
      } else if (firstName.length > 50) {
        rowErrors.push({
          row: rowNumber,
          field: 'First Name',
          message: 'First name must be less than 50 characters'
        })
      }
      
      // Validate Last Name
      const lastName = String(row['Last Name'] || '').trim()
      if (!lastName) {
        rowErrors.push({
          row: rowNumber,
          field: 'Last Name',
          message: 'Last name is required'
        })
      } else if (lastName.length > 50) {
        rowErrors.push({
          row: rowNumber,
          field: 'Last Name',
          message: 'Last name must be less than 50 characters'
        })
      }
      
      // Validate Email
      const email = String(row['Email'] || '').trim().toLowerCase()
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!email) {
        rowErrors.push({
          row: rowNumber,
          field: 'Email',
          message: 'Email is required'
        })
      } else if (!emailRegex.test(email)) {
        rowErrors.push({
          row: rowNumber,
          field: 'Email',
          message: 'Valid email is required'
        })
      } else if (seenEmails.has(email)) {
        rowErrors.push({
          row: rowNumber,
          field: 'Email',
          message: 'Duplicate email found'
        })
      } else {
        seenEmails.add(email)
      }
      
      // Validate Phone
      const phoneRaw = String(row['Phone'] || '').replace(/[\s\-()]/g, '')
      if (!phoneRaw) {
        rowErrors.push({
          row: rowNumber,
          field: 'Phone',
          message: 'Phone number is required'
        })
      } else if (phoneRaw.length < 10) {
        rowErrors.push({
          row: rowNumber,
          field: 'Phone',
          message: 'Valid phone number is required - 10+ digits'
        })
      }
      
      // Validate Role
      const role = String(row['Role'] || '').trim().toLowerCase()
      if (!role) {
        rowErrors.push({
          row: rowNumber,
          field: 'Role',
          message: 'Role is required'
        })
      } else if (!VALID_ROLES.includes(role)) {
        rowErrors.push({
          row: rowNumber,
          field: 'Role',
          message: `Role must be one of: ${VALID_ROLES.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}`
        })
      }
      
      // Validate Hourly Rate
      const rateStr = String(row['Hourly Rate'] || '').replace(/[$,\s]/g, '')
      const hourlyRate = parseFloat(rateStr)
      if (isNaN(hourlyRate) || hourlyRate <= 0) {
        rowErrors.push({
          row: rowNumber,
          field: 'Hourly Rate',
          message: 'Hourly rate must be a positive number'
        })
      }
      
      // Validate Start Date
      const dateStr = String(row['Start Date'] || '').trim()
      let startDate: Date | null = null
      
      if (!dateStr) {
        rowErrors.push({
          row: rowNumber,
          field: 'Start Date',
          message: 'Start date is required'
        })
      } else {
        // Try parsing DD/MM/YYYY format
        startDate = parse(dateStr, 'dd/MM/yyyy', new Date())
        
        if (!isValid(startDate)) {
          rowErrors.push({
            row: rowNumber,
            field: 'Start Date',
            message: 'Start date must be in DD/MM/YYYY format'
          })
        }
      }
      
      if (rowErrors.length > 0) {
        errors.push(...rowErrors)
      } else {
        validData.push({
          firstName,
          lastName,
          email,
          phone: phoneRaw,
          role,
          hourlyRate: Math.round(hourlyRate * 100), // Convert to cents
          startDate: startDate!.toISOString()
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
    
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, field: 'file', message: error instanceof Error ? error.message : 'Unknown error' }],
      warnings: [],
      summary: { total_rows: 0, valid_rows: 0, invalid_rows: 0 }
    }
  }
}

export function downloadStaffTemplate() {
  const template = [
    {
      'First Name': 'John',
      'Last Name': 'Smith',
      'Email': 'john.smith@example.com',
      'Phone': '0412 345 678',
      'Role': 'Manager',
      'Hourly Rate': 35.00,
      'Start Date': '01/01/2025'
    },
    {
      'First Name': 'Sarah',
      'Last Name': 'Johnson',
      'Email': 'sarah.j@example.com',
      'Phone': '0423 456 789',
      'Role': 'Kitchen',
      'Hourly Rate': 28.50,
      'Start Date': '15/01/2025'
    },
    {
      'First Name': 'Mike',
      'Last Name': 'Williams',
      'Email': 'mike.w@example.com',
      'Phone': '0434 567 890',
      'Role': 'Front of House',
      'Hourly Rate': 25.00,
      'Start Date': '01/02/2025'
    }
  ]
  
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'STAFF')
  XLSX.writeFile(wb, 'SuperSolt_Staff_Template.xlsx')
}
