import * as XLSX from 'xlsx'
import { parse, isValid, format as formatDate } from 'date-fns'

export interface ParsedOrder {
  order_number: string
  order_datetime: Date
  channel: 'dine-in' | 'takeaway' | 'delivery' | 'online'
  gross_inc_tax: number
  tax_amount: number
  discounts: number
  service_charge: number
  tip_amount: number
  is_void: boolean
  is_refund: boolean
  refund_reason?: string
  staff_member?: string
  customer_name?: string
  payment_method?: 'card' | 'cash' | 'digital_wallet'
  notes?: string
}

export interface ParseError {
  row: number
  column: string
  message: string
  severity: 'error' | 'critical'
}

export interface ParseWarning {
  row: number
  column: string
  message: string
}

export interface ParseResult {
  success: boolean
  data: ParsedOrder[]
  errors: ParseError[]
  warnings: ParseWarning[]
  summary: {
    total_rows: number
    valid_rows: number
    invalid_rows: number
    total_sales: number
    date_range: {
      start: Date | null
      end: Date | null
    }
  }
}

export async function parseOrdersExcel(file: File): Promise<ParseResult> {
  const errors: ParseError[] = []
  const warnings: ParseWarning[] = []
  const validOrders: ParsedOrder[] = []
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    
    if (!workbook.SheetNames.includes('ORDERS')) {
      return {
        success: false,
        data: [],
        errors: [{
          row: 0,
          column: 'file',
          message: 'Excel file must contain a sheet named "ORDERS"',
          severity: 'critical'
        }],
        warnings: [],
        summary: {
          total_rows: 0,
          valid_rows: 0,
          invalid_rows: 0,
          total_sales: 0,
          date_range: { start: null, end: null }
        }
      }
    }
    
    const ordersSheet = workbook.Sheets['ORDERS']
    const rawData = XLSX.utils.sheet_to_json(ordersSheet, { 
      raw: false,
      defval: ''
    })
    
    if (rawData.length === 0) {
      return {
        success: false,
        data: [],
        errors: [{
          row: 0,
          column: 'sheet',
          message: 'ORDERS sheet is empty',
          severity: 'critical'
        }],
        warnings: [],
        summary: {
          total_rows: 0,
          valid_rows: 0,
          invalid_rows: 0,
          total_sales: 0,
          date_range: { start: null, end: null }
        }
      }
    }
    
    let totalSales = 0
    let minDate: Date | null = null
    let maxDate: Date | null = null
    const orderNumbers = new Set<string>()
    
    rawData.forEach((row: Record<string, unknown>, index: number) => {
      const rowNumber = index + 2
      let hasErrors = false
      
      // Validate order_number
      if (!row.order_number) {
        errors.push({
          row: rowNumber,
          column: 'order_number',
          message: 'Order number is required',
          severity: 'error'
        })
        hasErrors = true
      } else if (orderNumbers.has(row.order_number)) {
        errors.push({
          row: rowNumber,
          column: 'order_number',
          message: `Duplicate order number: ${row.order_number}`,
          severity: 'error'
        })
        hasErrors = true
      } else {
        orderNumbers.add(row.order_number)
      }
      
      // Parse datetime (DD/MM/YYYY HH:MM)
      let orderDate: Date | null = null
      if (!row.order_datetime) {
        errors.push({
          row: rowNumber,
          column: 'order_datetime',
          message: 'Order datetime is required',
          severity: 'error'
        })
        hasErrors = true
      } else {
        orderDate = parse(row.order_datetime, 'dd/MM/yyyy HH:mm', new Date())
        if (!isValid(orderDate)) {
          errors.push({
            row: rowNumber,
            column: 'order_datetime',
            message: `Invalid date format. Expected DD/MM/YYYY HH:MM, got: ${row.order_datetime}`,
            severity: 'error'
          })
          hasErrors = true
          orderDate = null
        } else {
          if (!minDate || orderDate < minDate) minDate = orderDate
          if (!maxDate || orderDate > maxDate) maxDate = orderDate
        }
      }
      
      // Validate channel
      const validChannels = ['dine-in', 'takeaway', 'delivery', 'online']
      const channel = row.channel?.toLowerCase().trim()
      if (!channel) {
        errors.push({
          row: rowNumber,
          column: 'channel',
          message: 'Channel is required',
          severity: 'error'
        })
        hasErrors = true
      } else if (!validChannels.includes(channel)) {
        errors.push({
          row: rowNumber,
          column: 'channel',
          message: `Invalid channel: ${row.channel}. Must be one of: ${validChannels.join(', ')}`,
          severity: 'error'
        })
        hasErrors = true
      }
      
      // Parse amounts
      const grossIncTax = parseFloat(row.gross_inc_tax)
      if (isNaN(grossIncTax) || grossIncTax < 0) {
        errors.push({
          row: rowNumber,
          column: 'gross_inc_tax',
          message: 'Gross amount must be a positive number',
          severity: 'error'
        })
        hasErrors = true
      }
      
      const taxAmount = parseFloat(row.tax_amount)
      if (isNaN(taxAmount) || taxAmount < 0) {
        errors.push({
          row: rowNumber,
          column: 'tax_amount',
          message: 'Tax amount must be a positive number',
          severity: 'error'
        })
        hasErrors = true
      }
      
      // Check tax is roughly 10% (warning)
      if (!isNaN(grossIncTax) && !isNaN(taxAmount)) {
        const expectedTax = grossIncTax * 0.1
        const taxDifference = Math.abs(taxAmount - expectedTax)
        if (taxDifference > 0.50) {
          warnings.push({
            row: rowNumber,
            column: 'tax_amount',
            message: `Tax amount (${taxAmount.toFixed(2)}) doesn't match 10% of gross (expected ~${expectedTax.toFixed(2)})`
          })
        }
      }
      
      const discounts = parseFloat(row.discounts) || 0
      const serviceCharge = parseFloat(row.service_charge) || 0
      const tipAmount = parseFloat(row.tip_amount) || 0
      
      const isVoid = row.is_void?.toString().toUpperCase() === 'TRUE'
      const isRefund = row.is_refund?.toString().toUpperCase() === 'TRUE'
      
      if (isRefund && !row.refund_reason) {
        warnings.push({
          row: rowNumber,
          column: 'refund_reason',
          message: 'Refunded order has no refund reason provided'
        })
      }
      
      let paymentMethod: 'card' | 'cash' | 'digital_wallet' | undefined
      if (row.payment_method) {
        const pm = String(row.payment_method).toLowerCase().trim()
        if (['card', 'cash', 'digital_wallet'].includes(pm)) {
          paymentMethod = pm as 'card' | 'cash' | 'digital_wallet'
        }
      }
      
      if (!hasErrors && orderDate) {
        const order: ParsedOrder = {
          order_number: row.order_number,
          order_datetime: orderDate,
          channel: channel as 'dine-in' | 'takeaway' | 'delivery' | 'online',
          gross_inc_tax: grossIncTax,
          tax_amount: taxAmount,
          discounts,
          service_charge: serviceCharge,
          tip_amount: tipAmount,
          is_void: isVoid,
          is_refund: isRefund,
          refund_reason: row.refund_reason || undefined,
          staff_member: row.staff_member || undefined,
          customer_name: row.customer_name || undefined,
          payment_method: paymentMethod,
          notes: row.notes || undefined
        }
        
        validOrders.push(order)
        if (!isVoid && !isRefund) {
          totalSales += grossIncTax
        }
      }
    })
    
    return {
      success: errors.length === 0,
      data: validOrders,
      errors,
      warnings,
      summary: {
        total_rows: rawData.length,
        valid_rows: validOrders.length,
        invalid_rows: rawData.length - validOrders.length,
        total_sales: totalSales,
        date_range: {
          start: minDate,
          end: maxDate
        }
      }
    }
    
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [{
        row: 0,
        column: 'file',
        message: `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      }],
      warnings: [],
      summary: {
        total_rows: 0,
        valid_rows: 0,
        invalid_rows: 0,
        total_sales: 0,
        date_range: { start: null, end: null }
      }
    }
  }
}

export function downloadTemplate() {
  const templateData = [
    {
      order_number: 'ORD001',
      order_datetime: '27/10/2024 08:30',
      channel: 'dine-in',
      gross_inc_tax: 23.50,
      tax_amount: 2.14,
      discounts: 0.00,
      service_charge: 0.00,
      tip_amount: 2.00,
      is_void: 'FALSE',
      is_refund: 'FALSE',
      refund_reason: '',
      staff_member: 'Sarah J',
      customer_name: 'Table 5',
      payment_method: 'card',
      notes: ''
    }
  ]
  
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(templateData)
  XLSX.utils.book_append_sheet(wb, ws, 'ORDERS')
  XLSX.writeFile(wb, 'SuperSolt-Sales-Import-Template.xlsx')
}
