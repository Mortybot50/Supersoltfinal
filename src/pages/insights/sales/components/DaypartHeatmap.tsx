import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DaypartCell } from '../types/sales.types'
import { formatCurrency } from '../utils/formatters'
import { useMemo } from 'react'

interface DaypartHeatmapProps {
  daypartData: DaypartCell[]
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6am to 9pm

export function DaypartHeatmap({ daypartData }: DaypartHeatmapProps) {
  const { maxSales, heatmapGrid } = useMemo(() => {
    const max = Math.max(...daypartData.map(d => d.sales), 1)
    
    // Create a grid with all day/hour combinations
    const grid: Record<string, DaypartCell | null> = {}
    DAYS.forEach(day => {
      HOURS.forEach(hour => {
        const key = `${day}-${hour}`
        const cell = daypartData.find(d => d.day === day && d.hour === hour)
        grid[key] = cell || null
      })
    })
    
    return { maxSales: max, heatmapGrid: grid }
  }, [daypartData])
  
  const getIntensity = (sales: number) => {
    const intensity = sales / maxSales
    if (intensity > 0.8) return 'bg-green-600 text-white'
    if (intensity > 0.6) return 'bg-green-500 text-white'
    if (intensity > 0.4) return 'bg-green-400'
    if (intensity > 0.2) return 'bg-green-300'
    if (intensity > 0) return 'bg-green-200'
    return 'bg-muted'
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Heatmap by Day & Hour</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="grid grid-cols-[80px_repeat(16,minmax(50px,1fr))] gap-1">
              {/* Header row */}
              <div className="text-xs font-medium text-muted-foreground"></div>
              {HOURS.map(hour => (
                <div key={hour} className="text-xs font-medium text-center text-muted-foreground">
                  {hour}:00
                </div>
              ))}
              
              {/* Data rows */}
              {DAYS.map(day => (
                <div key={day} className="contents">
                  <div className="text-xs font-medium text-muted-foreground flex items-center">
                    {day}
                  </div>
                  {HOURS.map(hour => {
                    const cell = heatmapGrid[`${day}-${hour}`]
                    return (
                      <div
                        key={`${day}-${hour}`}
                        className={`text-xs p-2 rounded text-center cursor-help transition-colors ${
                          cell ? getIntensity(cell.sales) : 'bg-muted'
                        }`}
                        title={cell ? `${day} ${hour}:00\nSales: ${formatCurrency(cell.sales)}\nOrders: ${cell.orders}` : 'No data'}
                      >
                        {cell ? formatCurrency(cell.sales).replace('$', '').replace(',', 'k').slice(0, 4) : '-'}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
          <span>Low</span>
          <div className="flex gap-1">
            <div className="w-6 h-4 bg-green-200 rounded"></div>
            <div className="w-6 h-4 bg-green-300 rounded"></div>
            <div className="w-6 h-4 bg-green-400 rounded"></div>
            <div className="w-6 h-4 bg-green-500 rounded"></div>
            <div className="w-6 h-4 bg-green-600 rounded"></div>
          </div>
          <span>High</span>
        </div>
      </CardContent>
    </Card>
  )
}
