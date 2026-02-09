import { RosterShift, RosterWarning, AU_HOSPITALITY_PENALTY_RATES, AU_PUBLIC_HOLIDAYS_2024, LaborBudget, StaffAvailability, HourlyStaffing, DayStats } from '@/types'
import { startOfMonth, endOfMonth, eachDayOfInterval, addMonths } from 'date-fns'

// ============================================
// BASIC CALCULATIONS
// ============================================

/**
 * Calculate the total hours and cost for a shift (with penalty rates)
 */
export function calculateShiftHoursAndCost(
  startTime: string,
  endTime: string,
  breakMinutes: number,
  hourlyRateCents: number,
  date?: Date,
  isCasual: boolean = false,
  state: string = 'VIC'
): {
  hours: number
  baseCost: number
  penaltyCost: number
  cost: number
  penaltyType: string
  penaltyMultiplier: number
} {
  // Parse times (HH:MM format)
  const [startH, startM] = startTime.split(':').map(Number)
  const [endH, endM] = endTime.split(':').map(Number)

  // Calculate total minutes
  let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM)

  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60
  }

  // Subtract break
  const workMinutes = Math.max(0, totalMinutes - breakMinutes)
  const hours = workMinutes / 60

  // Calculate penalty multiplier
  const { penaltyType, penaltyMultiplier } = calculatePenaltyRate(date, startTime, endTime, state)

  // Apply casual loading if applicable
  let effectiveMultiplier = penaltyMultiplier
  if (isCasual && penaltyMultiplier === 1) {
    effectiveMultiplier = AU_HOSPITALITY_PENALTY_RATES.casual_loading
  }

  // Calculate costs
  const baseCost = Math.round(hours * hourlyRateCents)
  const totalCost = Math.round(hours * hourlyRateCents * effectiveMultiplier)
  const penaltyCost = totalCost - baseCost

  return {
    hours: Math.round(hours * 100) / 100,
    baseCost,
    penaltyCost,
    cost: totalCost,
    penaltyType,
    penaltyMultiplier: effectiveMultiplier,
  }
}

/**
 * Calculate penalty rate based on day and time
 */
export function calculatePenaltyRate(
  date?: Date,
  startTime?: string,
  endTime?: string,
  state: string = 'VIC'
): { penaltyType: string; penaltyMultiplier: number } {
  if (!date) {
    return { penaltyType: 'none', penaltyMultiplier: 1 }
  }

  const dateStr = date.toISOString().split('T')[0]
  const dayOfWeek = date.getDay()

  // Check public holidays first (highest rate)
  const allHolidays = [
    ...AU_PUBLIC_HOLIDAYS_2024.national,
    ...(AU_PUBLIC_HOLIDAYS_2024[state] || []),
  ]
  if (allHolidays.includes(dateStr)) {
    return {
      penaltyType: 'public_holiday',
      penaltyMultiplier: AU_HOSPITALITY_PENALTY_RATES.public_holiday,
    }
  }

  // Check Sunday
  if (dayOfWeek === 0) {
    return {
      penaltyType: 'sunday',
      penaltyMultiplier: AU_HOSPITALITY_PENALTY_RATES.sunday,
    }
  }

  // Check Saturday
  if (dayOfWeek === 6) {
    return {
      penaltyType: 'saturday',
      penaltyMultiplier: AU_HOSPITALITY_PENALTY_RATES.saturday,
    }
  }

  // Check late night (after 10pm) or early morning (before 7am)
  if (startTime && endTime) {
    const [startH] = startTime.split(':').map(Number)
    const [endH] = endTime.split(':').map(Number)

    if (endH >= 22 || (endH < 7 && endH > 0)) {
      return {
        penaltyType: 'late_night',
        penaltyMultiplier: AU_HOSPITALITY_PENALTY_RATES.late_night,
      }
    }

    if (startH < 7) {
      return {
        penaltyType: 'early_morning',
        penaltyMultiplier: AU_HOSPITALITY_PENALTY_RATES.early_morning,
      }
    }
  }

  return { penaltyType: 'none', penaltyMultiplier: 1 }
}

// ============================================
// WEEKLY METRICS
// ============================================

/**
 * Calculate weekly roster metrics
 */
export function calculateWeeklyRosterMetrics(shifts: RosterShift[]): {
  totalHours: number
  totalCost: number
  baseCost: number
  penaltyCost: number
  shiftCount: number
  staffCount: number
  avgHourlyRate: number
} {
  const activeShifts = shifts.filter((s) => s.status !== 'cancelled')
  const uniqueStaff = new Set(activeShifts.map((s) => s.staff_id))

  const result = activeShifts.reduce(
    (acc, shift) => ({
      totalHours: acc.totalHours + shift.total_hours,
      totalCost: acc.totalCost + shift.total_cost,
      baseCost: acc.baseCost + (shift.base_cost || shift.total_cost),
      penaltyCost: acc.penaltyCost + (shift.penalty_cost || 0),
      shiftCount: acc.shiftCount + 1,
      staffCount: uniqueStaff.size,
    }),
    { totalHours: 0, totalCost: 0, baseCost: 0, penaltyCost: 0, shiftCount: 0, staffCount: 0 }
  )

  return {
    ...result,
    avgHourlyRate: result.totalHours > 0 ? Math.round(result.totalCost / result.totalHours) : 0,
  }
}

/**
 * Calculate labor budget variance
 */
export function calculateBudgetVariance(
  budget: LaborBudget | null,
  actualCost: number
): {
  budgeted: number
  actual: number
  variance: number
  variancePercent: number
  status: 'under' | 'warning' | 'over' | 'critical'
} {
  if (!budget) {
    return {
      budgeted: 0,
      actual: actualCost,
      variance: 0,
      variancePercent: 0,
      status: 'under',
    }
  }

  const variance = actualCost - budget.budgeted_amount
  const variancePercent = budget.budgeted_amount > 0
    ? (actualCost / budget.budgeted_amount) * 100
    : 0

  let status: 'under' | 'warning' | 'over' | 'critical' = 'under'
  if (variancePercent >= budget.critical_threshold_percent) {
    status = 'critical'
  } else if (variancePercent >= budget.warning_threshold_percent) {
    status = 'warning'
  } else if (variance > 0) {
    status = 'over'
  }

  return {
    budgeted: budget.budgeted_amount,
    actual: actualCost,
    variance,
    variancePercent: Math.round(variancePercent),
    status,
  }
}

// ============================================
// COMPLIANCE WARNINGS
// ============================================

/**
 * Check if a new/updated shift conflicts with existing shifts
 */
export function hasShiftConflict(
  shifts: RosterShift[],
  staffId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeShiftId?: string
): boolean {
  const dateStr = date.toISOString().split('T')[0]

  return shifts.some((s) => {
    // Skip cancelled shifts
    if (s.status === 'cancelled') return false
    // Skip the shift being edited
    if (excludeShiftId && s.id === excludeShiftId) return false
    // Only check same staff member
    if (s.staff_id !== staffId) return false
    // Only check same date
    const shiftDateStr = new Date(s.date).toISOString().split('T')[0]
    if (shiftDateStr !== dateStr) return false

    // Check time overlap
    const [newStartH, newStartM] = startTime.split(':').map(Number)
    const [newEndH, newEndM] = endTime.split(':').map(Number)
    const [existStartH, existStartM] = s.start_time.split(':').map(Number)
    const [existEndH, existEndM] = s.end_time.split(':').map(Number)

    const newStart = newStartH * 60 + newStartM
    const newEnd = newEndH * 60 + newEndM
    const existStart = existStartH * 60 + existStartM
    const existEnd = existEndH * 60 + existEndM

    // Overlap check: not (newEnd <= existStart || newStart >= existEnd)
    return !(newEnd <= existStart || newStart >= existEnd)
  })
}

/**
 * Detect rest gap violations (<10h between shifts)
 */
export function detectRestGapWarnings(
  shifts: RosterShift[]
): RosterWarning[] {
  const warnings: RosterWarning[] = []
  const activeShifts = shifts.filter((s) => s.status !== 'cancelled')

  // Group shifts by staff
  const byStaff: Record<string, RosterShift[]> = {}
  activeShifts.forEach((s) => {
    if (!byStaff[s.staff_id]) {
      byStaff[s.staff_id] = []
    }
    byStaff[s.staff_id].push(s)
  })

  // Check each staff member's shifts
  for (const [staffId, staffShifts] of Object.entries(byStaff)) {
    // Sort by date and start time
    const sorted = staffShifts.sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime()
      }
      return a.start_time.localeCompare(b.start_time)
    })

    // Check gaps between consecutive shifts
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      // Calculate end time of current shift
      const currentDate = new Date(current.date)
      const [endH, endM] = current.end_time.split(':').map(Number)
      currentDate.setHours(endH, endM, 0, 0)

      // Handle overnight shifts
      const [startH] = current.start_time.split(':').map(Number)
      if (endH < startH) {
        currentDate.setDate(currentDate.getDate() + 1)
      }

      // Calculate start time of next shift
      const nextDate = new Date(next.date)
      const [nextStartH, nextStartM] = next.start_time.split(':').map(Number)
      nextDate.setHours(nextStartH, nextStartM, 0, 0)

      // Calculate gap in hours
      const gapMs = nextDate.getTime() - currentDate.getTime()
      const gapHours = gapMs / (1000 * 60 * 60)

      // Minimum 10 hour rest required
      if (gapHours >= 0 && gapHours < 10) {
        warnings.push({
          id: `rest-${current.id}-${next.id}`,
          shift_id: next.id,
          staff_id: staffId,
          staff_name: current.staff_name,
          type: 'rest_gap',
          severity: gapHours < 8 ? 'error' : 'warning',
          message: `Only ${gapHours.toFixed(1)}h rest before next shift (minimum 10h required)`,
          details: {
            gap_hours: gapHours,
            shift_date: new Date(next.date).toISOString().split('T')[0],
          },
          acknowledged: false,
        })
      }
    }
  }

  return warnings
}

/**
 * Detect break requirement violations (no break for shifts >5h)
 */
export function detectBreakWarnings(shifts: RosterShift[]): RosterWarning[] {
  const warnings: RosterWarning[] = []
  const activeShifts = shifts.filter((s) => s.status !== 'cancelled')

  activeShifts.forEach((shift) => {
    // Shifts over 5 hours require at least 30 min break
    if (shift.total_hours > 5 && shift.break_minutes < 30) {
      warnings.push({
        id: `break-${shift.id}`,
        shift_id: shift.id,
        staff_id: shift.staff_id,
        staff_name: shift.staff_name,
        type: 'break_required',
        severity: 'warning',
        message: `${shift.total_hours.toFixed(1)}h shift requires 30min break (only ${shift.break_minutes}min scheduled)`,
        details: {
          hours: shift.total_hours,
          limit: 5,
        },
        acknowledged: false,
      })
    }

    // Shifts over 10 hours require additional breaks
    if (shift.total_hours > 10 && shift.break_minutes < 60) {
      warnings.push({
        id: `break-long-${shift.id}`,
        shift_id: shift.id,
        staff_id: shift.staff_id,
        staff_name: shift.staff_name,
        type: 'break_required',
        severity: 'error',
        message: `${shift.total_hours.toFixed(1)}h shift requires 60min total breaks (only ${shift.break_minutes}min scheduled)`,
        details: {
          hours: shift.total_hours,
          limit: 10,
        },
        acknowledged: false,
      })
    }
  })

  return warnings
}

/**
 * Detect overtime warnings for staff (>38h/week or >10h/day)
 */
export function detectOvertimeWarnings(
  shifts: RosterShift[]
): Array<{ staffId: string; staffName: string; hours: number; warning: string; type: 'weekly' | 'daily' }> {
  const warnings: Array<{ staffId: string; staffName: string; hours: number; warning: string; type: 'weekly' | 'daily' }> = []
  const activeShifts = shifts.filter((s) => s.status !== 'cancelled')

  // Check weekly hours per staff
  const byStaff: Record<string, { name: string; hours: number }> = {}
  activeShifts.forEach((s) => {
    if (!byStaff[s.staff_id]) {
      byStaff[s.staff_id] = { name: s.staff_name, hours: 0 }
    }
    byStaff[s.staff_id].hours += s.total_hours
  })

  for (const [staffId, data] of Object.entries(byStaff)) {
    if (data.hours > 38) {
      warnings.push({
        staffId,
        staffName: data.name,
        hours: data.hours,
        warning: `${data.hours.toFixed(1)}h rostered (exceeds 38h/week)`,
        type: 'weekly',
      })
    }
  }

  // Check daily hours (>10h)
  const byStaffDay: Record<string, { name: string; hours: number; date: string }> = {}
  activeShifts.forEach((s) => {
    const dateStr = new Date(s.date).toISOString().split('T')[0]
    const key = `${s.staff_id}_${dateStr}`
    if (!byStaffDay[key]) {
      byStaffDay[key] = { name: s.staff_name, hours: 0, date: dateStr }
    }
    byStaffDay[key].hours += s.total_hours
  })

  for (const [key, data] of Object.entries(byStaffDay)) {
    if (data.hours > 10) {
      const staffId = key.split('_')[0]
      warnings.push({
        staffId,
        staffName: data.name,
        hours: data.hours,
        warning: `${data.hours.toFixed(1)}h on ${data.date} (exceeds 10h/day)`,
        type: 'daily',
      })
    }
  }

  return warnings
}

/**
 * Check availability conflicts
 */
export function detectAvailabilityConflicts(
  shifts: RosterShift[],
  availability: StaffAvailability[]
): RosterWarning[] {
  const warnings: RosterWarning[] = []
  const activeShifts = shifts.filter((s) => s.status !== 'cancelled')

  activeShifts.forEach((shift) => {
    const shiftDate = new Date(shift.date)
    const dayOfWeek = shiftDate.getDay()
    const dateStr = shiftDate.toISOString().split('T')[0]

    // Find unavailability for this staff member
    const staffUnavailable = availability.filter(
      (a) => a.staff_id === shift.staff_id && a.type === 'unavailable'
    )

    staffUnavailable.forEach((unavail) => {
      let isConflict = false

      if (unavail.is_recurring && unavail.day_of_week === dayOfWeek) {
        isConflict = true
      } else if (unavail.specific_date) {
        const unavailDate = new Date(unavail.specific_date).toISOString().split('T')[0]
        if (unavailDate === dateStr) {
          isConflict = true
        }
      }

      if (isConflict) {
        warnings.push({
          id: `avail-${shift.id}-${unavail.id}`,
          shift_id: shift.id,
          staff_id: shift.staff_id,
          staff_name: shift.staff_name,
          type: 'availability_conflict',
          severity: 'warning',
          message: `Scheduled during marked unavailability${unavail.notes ? `: ${unavail.notes}` : ''}`,
          details: {
            shift_date: dateStr,
          },
          acknowledged: false,
        })
      }
    })
  })

  return warnings
}

/**
 * Get all roster warnings combined
 */
export function getAllRosterWarnings(
  shifts: RosterShift[],
  availability: StaffAvailability[] = [],
  budget: LaborBudget | null = null
): RosterWarning[] {
  const warnings: RosterWarning[] = []

  // Rest gap warnings
  warnings.push(...detectRestGapWarnings(shifts))

  // Break warnings
  warnings.push(...detectBreakWarnings(shifts))

  // Availability conflicts
  warnings.push(...detectAvailabilityConflicts(shifts, availability))

  // Overtime warnings (convert to RosterWarning format)
  const overtimeWarnings = detectOvertimeWarnings(shifts)
  overtimeWarnings.forEach((ow) => {
    warnings.push({
      id: `overtime-${ow.staffId}-${ow.type}`,
      staff_id: ow.staffId,
      staff_name: ow.staffName,
      type: ow.type === 'weekly' ? 'overtime_weekly' : 'overtime_daily',
      severity: ow.hours > 45 ? 'error' : 'warning',
      message: ow.warning,
      details: {
        hours: ow.hours,
        limit: ow.type === 'weekly' ? 38 : 10,
      },
      acknowledged: false,
    })
  })

  // Budget warnings
  if (budget) {
    const metrics = calculateWeeklyRosterMetrics(shifts)
    const budgetStatus = calculateBudgetVariance(budget, metrics.totalCost)

    if (budgetStatus.status === 'over' || budgetStatus.status === 'critical') {
      warnings.push({
        id: `budget-${budget.id}`,
        staff_id: '',
        staff_name: 'All Staff',
        type: 'budget_exceeded',
        severity: budgetStatus.status === 'critical' ? 'error' : 'warning',
        message: `Labor cost ${budgetStatus.variancePercent}% of budget ($${(budgetStatus.actual / 100).toFixed(2)} of $${(budgetStatus.budgeted / 100).toFixed(2)})`,
        acknowledged: false,
      })
    }
  }

  return warnings
}

// ============================================
// DATE & TIME UTILITIES
// ============================================

/**
 * Get shifts for a specific week
 */
export function getShiftsForWeek(
  shifts: RosterShift[],
  weekStart: Date
): RosterShift[] {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const weekStartNorm = new Date(weekStart)
  weekStartNorm.setHours(0, 0, 0, 0)

  return shifts.filter((s) => {
    const shiftDate = new Date(s.date)
    shiftDate.setHours(12, 0, 0, 0) // Normalize to noon to avoid timezone issues
    return shiftDate >= weekStartNorm && shiftDate <= weekEnd
  })
}

/**
 * Get the start of the week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get array of dates for the week
 */
export function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    dates.push(date)
  }
  return dates
}

/**
 * Check if a date is a public holiday
 */
export function isPublicHoliday(date: Date, state: string = 'VIC'): boolean {
  const dateStr = date.toISOString().split('T')[0]
  const allHolidays = [
    ...AU_PUBLIC_HOLIDAYS_2024.national,
    ...(AU_PUBLIC_HOLIDAYS_2024[state] || []),
  ]
  return allHolidays.includes(dateStr)
}

/**
 * Get public holiday name if applicable
 */
export function getPublicHolidayName(date: Date, state: string = 'VIC'): string | null {
  const dateStr = date.toISOString().split('T')[0]

  const holidayNames: Record<string, string> = {
    '2024-01-01': "New Year's Day",
    '2024-01-26': 'Australia Day',
    '2024-03-29': 'Good Friday',
    '2024-03-30': 'Easter Saturday',
    '2024-03-31': 'Easter Sunday',
    '2024-04-01': 'Easter Monday',
    '2024-04-25': 'ANZAC Day',
    '2024-12-25': 'Christmas Day',
    '2024-12-26': 'Boxing Day',
    // VIC specific
    '2024-03-12': 'Labour Day (VIC)',
    '2024-11-05': 'Melbourne Cup Day',
  }

  return holidayNames[dateStr] || null
}

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format currency from cents
 */
export function formatLabourCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Format hours with 1 decimal place
 */
export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`
}

/**
 * Format penalty rate as percentage
 */
export function formatPenaltyRate(multiplier: number): string {
  if (multiplier === 1) return 'Base rate'
  return `${Math.round(multiplier * 100)}%`
}

/**
 * Get penalty rate badge color
 */
export function getPenaltyBadgeColor(penaltyType: string): string {
  switch (penaltyType) {
    case 'public_holiday':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'sunday':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'saturday':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'late_night':
    case 'early_morning':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// ============================================
// EXTENDED DATE UTILITIES
// ============================================

/**
 * Get array of 14 dates for a fortnight starting from a given Monday
 */
export function getFortnightDates(weekStart: Date): Date[] {
  const dates: Date[] = []
  for (let i = 0; i < 14; i++) {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    dates.push(date)
  }
  return dates
}

/**
 * Get all dates in the month containing the given date
 */
export function getMonthDates(date: Date): Date[] {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  return eachDayOfInterval({ start: monthStart, end: monthEnd })
}

/**
 * Get shifts for a date range (generalized filter)
 */
export function getShiftsForDateRange(
  shifts: RosterShift[],
  rangeStart: Date,
  rangeEnd: Date
): RosterShift[] {
  const startNorm = new Date(rangeStart)
  startNorm.setHours(0, 0, 0, 0)
  const endNorm = new Date(rangeEnd)
  endNorm.setHours(23, 59, 59, 999)

  return shifts.filter((s) => {
    const shiftDate = new Date(s.date)
    shiftDate.setHours(12, 0, 0, 0)
    return shiftDate >= startNorm && shiftDate <= endNorm
  })
}

/**
 * Get shifts for a single day
 */
export function getShiftsForDay(shifts: RosterShift[], date: Date): RosterShift[] {
  const dateStr = date.toISOString().split('T')[0]
  return shifts.filter((s) => {
    const shiftDate = new Date(s.date).toISOString().split('T')[0]
    return shiftDate === dateStr && s.status !== 'cancelled'
  })
}

/**
 * Calculate hourly staffing counts for the day demand chart
 * Returns 30-minute interval data from 6am to 11pm
 */
export function calculateHourlyStaffing(shifts: RosterShift[], date: Date): HourlyStaffing[] {
  const dayShifts = getShiftsForDay(shifts, date).filter(s => !s.is_open_shift)
  const slots: HourlyStaffing[] = []

  for (let hour = 6; hour <= 23; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 23 && minute === 30) break

      const slotMinutes = hour * 60 + minute

      // Count how many staff are working at this slot
      let staffCount = 0
      dayShifts.forEach((shift) => {
        const [startH, startM] = shift.start_time.split(':').map(Number)
        const [endH, endM] = shift.end_time.split(':').map(Number)
        let shiftStart = startH * 60 + startM
        let shiftEnd = endH * 60 + endM
        if (shiftEnd <= shiftStart) shiftEnd += 24 * 60 // overnight

        if (slotMinutes >= shiftStart && slotMinutes < shiftEnd) {
          staffCount++
        }
      })

      // Mock demand curve: peaks at lunch (12-2pm) and dinner (6-8pm)
      const t = hour + minute / 60
      const lunchPeak = Math.exp(-0.5 * ((t - 13) / 1.2) ** 2) * 8
      const dinnerPeak = Math.exp(-0.5 * ((t - 19) / 1.5) ** 2) * 10
      const baseDemand = 2
      const predictedDemand = Math.round((baseDemand + lunchPeak + dinnerPeak) * 10) / 10

      const ampm = hour >= 12 ? 'pm' : 'am'
      const hour12 = hour % 12 || 12
      const label = minute === 0 ? `${hour12}${ampm}` : `${hour12}:30${ampm}`

      slots.push({ hour, minute, label, staffCount, predictedDemand })
    }
  }

  return slots
}

/**
 * Calculate per-day stats for the sidebar/day view
 */
export function calculateDayStats(shifts: RosterShift[], date: Date, salesForecast?: number): DayStats {
  const dayShifts = getShiftsForDay(shifts, date).filter(s => !s.is_open_shift)
  const uniqueStaff = new Set(dayShifts.map(s => s.staff_id))

  const totalHours = dayShifts.reduce((sum, s) => sum + s.total_hours, 0)
  const totalCost = dayShifts.reduce((sum, s) => sum + s.total_cost, 0)
  const forecast = salesForecast ?? 500000 // default $5,000 in cents

  return {
    date,
    totalHours,
    totalCost,
    shiftCount: dayShifts.length,
    staffCount: uniqueStaff.size,
    avgHourlyRate: totalHours > 0 ? Math.round(totalCost / totalHours) : 0,
    salesForecast: forecast,
    sph: totalHours > 0 ? Math.round(forecast / totalHours) : 0,
    wagePercentRevenue: forecast > 0 ? Math.round((totalCost / forecast) * 10000) / 100 : 0,
  }
}

/**
 * Format time for compact display (e.g., "6:00p" instead of "18:00")
 */
export function formatTimeCompact(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const suffix = hours >= 12 ? 'p' : 'a'
  const hour12 = hours % 12 || 12
  return minutes === 0 ? `${hour12}:00${suffix}` : `${hour12}:${minutes.toString().padStart(2, '0')}${suffix}`
}

// ============================================
// SHIFT TEMPLATES
// ============================================

/**
 * Apply a shift template to create a new shift
 */
export function applyShiftTemplate(
  template: {
    start_time: string
    end_time: string
    break_minutes: number
    role: string
  },
  staffId: string,
  staffName: string,
  date: Date,
  hourlyRateCents: number
): Omit<RosterShift, 'id'> {
  const calc = calculateShiftHoursAndCost(
    template.start_time,
    template.end_time,
    template.break_minutes,
    hourlyRateCents,
    date
  )

  return {
    venue_id: 'venue-1',
    staff_id: staffId,
    staff_name: staffName,
    date,
    start_time: template.start_time,
    end_time: template.end_time,
    break_minutes: template.break_minutes,
    role: template.role,
    status: 'scheduled',
    total_hours: calc.hours,
    base_cost: calc.baseCost,
    penalty_cost: calc.penaltyCost,
    total_cost: calc.cost,
    penalty_type: calc.penaltyType as RosterShift['penalty_type'],
    penalty_multiplier: calc.penaltyMultiplier,
  }
}
