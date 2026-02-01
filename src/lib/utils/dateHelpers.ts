import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, subDays, subWeeks, subMonths } from 'date-fns'

export type DatePreset = 'today' | 'week' | 'month' | 'prev-week' | 'prev-month'

export interface DateRange {
  startDate: Date
  endDate: Date
}

/**
 * Get date range for common presets
 */
export function getDateRangePreset(preset: DatePreset): DateRange {
  const now = new Date()
  
  switch (preset) {
    case 'today':
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now)
      }
    
    case 'week':
      return {
        startDate: startOfWeek(now, { weekStartsOn: 1 }), // Monday
        endDate: endOfWeek(now, { weekStartsOn: 1 })
      }
    
    case 'month':
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now)
      }
    
    case 'prev-week': {
      const lastWeek = subWeeks(now, 1)
      return {
        startDate: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        endDate: endOfWeek(lastWeek, { weekStartsOn: 1 })
      }
    }
    
    case 'prev-month': {
      const lastMonth = subMonths(now, 1)
      return {
        startDate: startOfMonth(lastMonth),
        endDate: endOfMonth(lastMonth)
      }
    }
    
    default:
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now)
      }
  }
}

/**
 * Get previous period for comparison
 */
export function getPreviousPeriod(range: DateRange): DateRange {
  const daysInRange = Math.ceil((range.endDate.getTime() - range.startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  return {
    startDate: subDays(range.startDate, daysInRange + 1),
    endDate: subDays(range.startDate, 1)
  }
}

/**
 * Check if a date falls within a range
 */
export function isDateInRange(date: Date, range: DateRange): boolean {
  return date >= range.startDate && date <= range.endDate
}
