import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { calculateOvertimeAnalysis } from '@/lib/utils/labourCalculations'
import { formatCurrency, formatNumber } from '@/lib/utils/formatters'
import { Clock } from 'lucide-react'

export function OvertimeAnalysis() {
  const { timesheets, staff } = useDataStore()
  
  const overtimeData = useMemo(() => 
    calculateOvertimeAnalysis(timesheets, staff),
    [timesheets, staff]
  )
  
  return (
    <Card className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="text-lg font-semibold">Overtime Analysis</h3>
            <p className="text-sm text-muted-foreground">Staff working beyond standard hours</p>
          </div>
          <Badge variant={overtimeData.total_overtime_hours > 0 ? 'destructive' : 'outline'}>
            {overtimeData.trend}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Overtime Hours</span>
            </div>
            <div className="text-2xl font-bold">
              {formatNumber(overtimeData.total_overtime_hours, 1)}
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Overtime Cost</div>
            <div className="text-2xl font-bold">
              {formatCurrency(overtimeData.total_overtime_cost)}
            </div>
          </div>
          
          <div className="border rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">% of Total Labour</div>
            <div className="text-2xl font-bold">
              {overtimeData.overtime_as_percent_of_total.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <h4 className="font-semibold mb-3">Staff with Overtime</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead className="text-right">OT Hours</TableHead>
              <TableHead className="text-right">OT Cost</TableHead>
              <TableHead className="text-right">Weeks</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overtimeData.staff_with_overtime.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground h-32">
                  No overtime recorded
                </TableCell>
              </TableRow>
            ) : (
              overtimeData.staff_with_overtime.slice(0, 10).map((staff) => (
                <TableRow key={staff.staff_id}>
                  <TableCell className="font-medium">{staff.staff_name}</TableCell>
                  <TableCell className="text-right">{formatNumber(staff.overtime_hours, 1)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(staff.overtime_cost)}</TableCell>
                  <TableCell className="text-right">{staff.weeks_with_overtime}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{staff.reason}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
