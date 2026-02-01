import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { parseISO, isValid } from 'date-fns'

export interface ImportResult<T> {
  success: boolean
  data: T[]
  errors: ImportError[]
  warnings: ImportWarning[]
  totalRows: number
  validRows: number
  invalidRows: number
}

export interface ImportError {
  row: number
  field: string
  value: any
  message: string
}

export interface ImportWarning {
  row: number
  field: string
  value: any
  message: string
}

// Parse Excel file
export async function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(firstSheet)
        resolve(jsonData)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = reject
    reader.readAsBinaryString(file)
  })
}

// Parse CSV file
export async function parseCSVFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: reject
    })
  })
}

// Detect file type and parse
export async function parseFile(file: File): Promise<any[]> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  if (extension === 'csv') {
    return parseCSVFile(file)
  } else if (extension === 'xlsx' || extension === 'xls') {
    return parseExcelFile(file)
  } else {
    throw new Error('Unsupported file format. Please use .xlsx, .xls, or .csv')
  }
}

// Download template Excel file
export function downloadTemplate(
  entityType: string,
  columns: { field: string; header: string; example: string }[]
) {
  const headers = columns.map(col => col.header)
  const examples = columns.map(col => col.example)
  
  const worksheet = XLSX.utils.aoa_to_sheet([headers, examples])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')
  
  XLSX.writeFile(workbook, `${entityType}-import-template.xlsx`)
}

// Export data to Excel
export function exportToExcel(
  data: any[],
  filename: string,
  sheetName: string = 'Export'
) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

// Helper functions for data cleaning
export function cleanString(value: any): string {
  if (!value) return ''
  return String(value).trim()
}

export function cleanNumber(value: any): number | null {
  if (!value) return null
  const num = Number(String(value).replace(/[$,]/g, ''))
  return isNaN(num) ? null : num
}

export function cleanDate(value: any): Date | null {
  if (!value) return null
  
  // Try parsing as ISO string
  const date = parseISO(String(value))
  if (isValid(date)) return date
  
  // Try parsing as Excel date number
  if (typeof value === 'number') {
    const excelDate = XLSX.SSF.parse_date_code(value)
    return new Date(excelDate.y, excelDate.m - 1, excelDate.d)
  }
  
  return null
}

export function cleanBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value
  const str = String(value).toLowerCase().trim()
  return ['true', 'yes', '1', 'y'].includes(str)
}

export function cleanEmail(value: any): string | null {
  const email = cleanString(value)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) ? email : null
}

export function cleanPhone(value: any): string {
  return cleanString(value).replace(/[^\d+]/g, '')
}

export function cleanABN(value: any): string {
  return cleanString(value).replace(/\s/g, '')
}
