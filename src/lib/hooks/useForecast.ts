import { useQuery } from '@tanstack/react-query'
import { startOfWeek, addWeeks, subWeeks } from 'date-fns'
import {
  getForecastForWeek,
  getWeeksOfData,
  getForecastAccuracy,
  getForecastAccuracyTrend,
} from '@/lib/services/forecastService'
import type { DailyForecast, AccuracyReport, WeekSummary } from '@/lib/services/forecastService'

/**
 * Hook: weekly forecast for current week (Mon-Sun).
 */
export function useWeeklyForecast(venueId: string | undefined) {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })

  return useQuery<DailyForecast[]>({
    queryKey: ['forecast', 'week', venueId, weekStart.toISOString()],
    queryFn: () => getForecastForWeek(venueId!, weekStart),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}

/**
 * Hook: next week's forecast.
 */
export function useNextWeekForecast(venueId: string | undefined) {
  const nextWeekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1)

  return useQuery<DailyForecast[]>({
    queryKey: ['forecast', 'week', venueId, nextWeekStart.toISOString()],
    queryFn: () => getForecastForWeek(venueId!, nextWeekStart),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook: weeks of historical data available.
 */
export function useWeeksOfData(venueId: string | undefined) {
  return useQuery<number>({
    queryKey: ['forecast', 'weeks-of-data', venueId],
    queryFn: () => getWeeksOfData(venueId!),
    enabled: !!venueId,
    staleTime: 30 * 60 * 1000,
  })
}

/**
 * Hook: accuracy report for last completed week.
 */
export function useLastWeekAccuracy(venueId: string | undefined) {
  const lastWeekStart = subWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1)

  return useQuery<AccuracyReport>({
    queryKey: ['forecast', 'accuracy', venueId, lastWeekStart.toISOString()],
    queryFn: () => getForecastAccuracy(venueId!, lastWeekStart),
    enabled: !!venueId,
    staleTime: 30 * 60 * 1000,
  })
}

/**
 * Hook: accuracy trend over recent weeks.
 */
export function useAccuracyTrend(venueId: string | undefined, weeksBack: number = 4) {
  return useQuery<WeekSummary[]>({
    queryKey: ['forecast', 'accuracy-trend', venueId, weeksBack],
    queryFn: () => getForecastAccuracyTrend(venueId!, weeksBack),
    enabled: !!venueId,
    staleTime: 30 * 60 * 1000,
  })
}
