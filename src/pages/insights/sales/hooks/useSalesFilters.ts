import { useState, useCallback } from 'react'
import { SalesFilters } from '../types/sales.types'
import { startOfWeek, endOfWeek } from 'date-fns'

/**
 * Hook to manage sales filters state
 */
export function useSalesFilters() {
  const [filters, setFilters] = useState<SalesFilters>({
    dateRange: {
      start: startOfWeek(new Date()),
      end: endOfWeek(new Date())
    },
    period: 'week',
    locations: [], // empty = all
    channels: [],  // empty = all
    compareTo: 'previous'
  })
  
  const updateDateRange = useCallback((start: Date, end: Date) => {
    setFilters(prev => ({
      ...prev,
      dateRange: { start, end }
    }))
  }, [])
  
  const updatePeriod = useCallback((period: SalesFilters['period']) => {
    setFilters(prev => ({
      ...prev,
      period
    }))
  }, [])
  
  const updateLocations = useCallback((locations: string[]) => {
    setFilters(prev => ({
      ...prev,
      locations
    }))
  }, [])
  
  const updateChannels = useCallback((channels: string[]) => {
    setFilters(prev => ({
      ...prev,
      channels
    }))
  }, [])
  
  const updateCompareTo = useCallback((compareTo: SalesFilters['compareTo']) => {
    setFilters(prev => ({
      ...prev,
      compareTo
    }))
  }, [])
  
  return {
    filters,
    updateDateRange,
    updatePeriod,
    updateLocations,
    updateChannels,
    updateCompareTo
  }
}
