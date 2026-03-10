/**
 * Timesheet Service — focused API for timesheet period management & payroll export.
 * Wraps labourService DB primitives and adds bulk/period operations.
 */

import {
  loadTimesheetsFromDB,
  approveTimesheetInDB,
  updateTimesheetInDB,
} from './labourService'
import { supabase } from '@/integrations/supabase/client'
import type { Timesheet } from '@/types'
import { format } from 'date-fns'

function dbError(err: unknown): string {
  if (!err) return 'Unknown error'
  if (typeof err === 'string') return err
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>
    return (e.message as string) || (e.details as string) || (e.hint as string) || JSON.stringify(err)
  }
  return String(err)
}

// ── Period fetch ─────────────────────────────────────────────────────────────

export async function getTimesheetsForPeriod(
  venueId: string,
  startDate: Date,
  endDate: Date,
): Promise<Timesheet[]> {
  return loadTimesheetsFromDB(venueId, { start: startDate, end: endDate })
}

// ── Single approve ───────────────────────────────────────────────────────────

export async function approveTimesheet(
  timesheetId: string,
  approvedBy: string,
): Promise<boolean> {
  return approveTimesheetInDB(timesheetId, approvedBy)
}

// ── Bulk approve ─────────────────────────────────────────────────────────────

export async function bulkApprove(
  timesheetIds: string[],
  approvedBy: string,
): Promise<boolean> {
  if (timesheetIds.length === 0) return true
  try {
    const { error } = await supabase
      .from('timesheets')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .in('id', timesheetIds)

    if (error) throw error
    return true
  } catch (err) {
    console.error('bulkApprove failed:', dbError(err))
    return false
  }
}

// ── Adjust ───────────────────────────────────────────────────────────────────

export interface TimesheetAdjustment {
  total_hours?: number
  gross_pay?: number
  break_minutes?: number
  clock_in?: Date
  clock_out?: Date
  status?: Timesheet['status']
  notes?: string
}

export async function adjustTimesheet(
  timesheetId: string,
  adjustments: TimesheetAdjustment,
  reason: string,
  _adjustedBy: string,
): Promise<boolean> {
  const updates: Partial<Timesheet> = { ...adjustments }
  // Append reason to notes
  if (adjustments.notes) {
    updates.notes = adjustments.notes
  } else if (reason) {
    updates.notes = reason
  }
  return updateTimesheetInDB(timesheetId, updates)
}

// ── Payroll CSV builder ──────────────────────────────────────────────────────

export type PayrollExportFormat = 'xero' | 'keypay' | 'myob' | 'csv'

export interface PayrollExportRow {
  name: string
  role: string
  actualHours: number
  rosteredHours: number
  variance: number
  hourlyRate: number        // cents
  baseCost: number          // cents
  penaltyCost: number       // cents
  grossPay: number          // cents
  superAmount: number       // cents
  total: number             // cents
}

export function buildPayrollCSV(
  rows: PayrollExportRow[],
  exportFormat: PayrollExportFormat,
  periodStart: Date,
  periodEnd: Date,
): string {
  const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd')
  const fmtAU = (d: Date) => format(d, 'dd/MM/yyyy')
  const dollars = (cents: number) => (cents / 100).toFixed(2)

  switch (exportFormat) {
    case 'xero':
      return [
        'Employee Name,Pay Period Start,Pay Period End,Ordinary Hours,Gross Pay,Superannuation',
        ...rows.map((r) =>
          `"${r.name}",${fmtDate(periodStart)},${fmtDate(periodEnd)},${r.actualHours.toFixed(2)},${dollars(r.grossPay)},${dollars(r.superAmount)}`,
        ),
      ].join('\n')

    case 'keypay':
      return [
        'Employee,Hours,Rate,Gross,Super',
        ...rows.map((r) =>
          `"${r.name}",${r.actualHours.toFixed(2)},${dollars(r.hourlyRate)},${dollars(r.grossPay)},${dollars(r.superAmount)}`,
        ),
      ].join('\n')

    case 'myob': {
      const periodLabel = `${fmtAU(periodStart)} - ${fmtAU(periodEnd)}`
      return [
        'Co./Last Name,First Name,Pay Period,Hours,Gross Pay,Super Guarantee',
        ...rows.map((r) => {
          const parts = r.name.split(' ')
          const lastName = parts.slice(-1).join(' ')
          const firstName = parts.slice(0, -1).join(' ')
          return `"${lastName}","${firstName}","${periodLabel}",${r.actualHours.toFixed(2)},${dollars(r.grossPay)},${dollars(r.superAmount)}`
        }),
      ].join('\n')
    }

    default:
      return [
        'Staff Name,Role,Rostered Hours,Actual Hours,Variance,Hourly Rate,Base Pay,Penalty Loading,Gross Pay,Super (11.5%),Total',
        ...rows.map((r) =>
          `"${r.name}","${r.role}",${r.rosteredHours.toFixed(2)},${r.actualHours.toFixed(2)},${r.variance.toFixed(2)},${dollars(r.hourlyRate)},${dollars(r.baseCost)},${dollars(r.penaltyCost)},${dollars(r.grossPay)},${dollars(r.superAmount)},${dollars(r.total)}`,
        ),
      ].join('\n')
  }
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
