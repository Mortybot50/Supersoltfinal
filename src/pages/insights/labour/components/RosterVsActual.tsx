import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { format, startOfWeek, addDays } from 'date-fns'
import { calculateRosteredHours } from '@/lib/utils/labourCalculations'
import { formatNumber } from '@/lib/utils/formatters'

export function RosterVsActual() {
  const { timesheets, rosterShifts } = useDataStore()
  
  const comparisonData = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const data = []
    
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i)
      const dayStr = format(day, 'yyyy-MM-dd')
      
      const dayShifts = rosterShifts.filter(s => 
        format(new Date(s.date), 'yyyy-MM-dd') === dayStr
      )
      
      const dayTimesheets = timesheets.filter(t => 
        format(new Date(t.date), 'yyyy-MM-dd') === dayStr &&
        t.status === 'approved'
      )
      
      const rosteredHours = calculateRosteredHours(dayShifts)
      const actualHours = dayTimesheets.reduce((sum, t) => sum + t.total_hours, 0)
      const variance = actualHours - rosteredHours
      const variancePercent = rosteredHours > 0 ? (variance / rosteredHours) * 100 : 0
      
      data.push({
        day: format(day, 'EEE dd MMM'),
        rostered: rosteredHours,
        actual: actualHours,
        variance,
        variancePercent
      })
    }
    
    return data
  }, [timesheets, rosterShifts])
  
  const totals = comparisonData.reduce((acc, day) => ({
    rostered: acc.rostered + day.rostered,
    actual: acc.actual + day.actual,
    variance: acc.variance + day.variance
  }), { rostered: 0, actual: 0, variance: 0 })
  
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Roster vs Actual Hours</h3>
        <p className="text-sm text-muted-foreground">This week comparison</p>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead className="text-right">Rostered Hours</TableHead>
            <TableHead className="text-right">Actual Hours</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead className="text-right">Variance %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {comparisonData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground h-32">
                No roster data available
              </TableCell>
            </TableRow>
          ) : (
            <>
              {comparisonData.map((day) => (
                <TableRow key={day.day}>
                  <TableCell className="font-medium">{day.day}</TableCell>
                  <TableCell className="text-right">{formatNumber(day.rostered, 1)}</TableCell>
                  <TableCell className="text-right">{formatNumber(day.actual, 1)}</TableCell>
                  <TableCell className="text-right">
                    <span className={day.variance > 0 ? 'text-orange-600' : day.variance < 0 ? 'text-green-600' : ''}>
                      {day.variance > 0 ? '+' : ''}{formatNumber(day.variance, 1)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={Math.abs(day.variancePercent) > 10 ? 'destructive' : 'outline'}>
                      {day.variancePercent > 0 ? '+' : ''}{formatNumber(day.variancePercent, 1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatNumber(totals.rostered, 1)}</TableCell>
                <TableCell className="text-right">{formatNumber(totals.actual, 1)}</TableCell>
                <TableCell className="text-right">
                  <span className={totals.variance > 0 ? 'text-orange-600' : totals.variance < 0 ? 'text-green-600' : ''}>
                    {totals.variance > 0 ? '+' : ''}{formatNumber(totals.variance, 1)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={Math.abs((totals.variance / totals.rostered) * 100) > 10 ? 'destructive' : 'outline'}>
                    {totals.rostered > 0 ? `${((totals.variance / totals.rostered) * 100).toFixed(1)}%` : '0.0%'}
                  </Badge>
                </TableCell>
              </TableRow>
            </>
          )}
        </TableBody>
      </Table>
    </Card>
  )
}
