import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { formatNumber } from '@/lib/utils/formatters'

export function StaffUtilization() {
  const { timesheets, staff } = useDataStore()
  
  const utilizationData = useMemo(() => {
    const staffMap = new Map(staff.map(s => [s.id, s]))
    const staffHours = new Map<string, number>()
    
    timesheets
      .filter(t => t.status === 'approved')
      .forEach(t => {
        const current = staffHours.get(t.staff_id) || 0
        staffHours.set(t.staff_id, current + t.total_hours)
      })
    
    const data = Array.from(staffHours.entries())
      .map(([staffId, hours]) => {
        const staffMember = staffMap.get(staffId)
        if (!staffMember) return null
        
        const availableHours = staffMember.employment_type === 'full-time' ? 38 : 30
        const utilization = (hours / availableHours) * 100
        
        return {
          staff_id: staffId,
          staff_name: staffMember.name,
          role: staffMember.role,
          hours,
          available: availableHours,
          utilization
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.utilization - a!.utilization)
    
    return data as NonNullable<typeof data[0]>[]
  }, [timesheets, staff])
  
  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 95) return 'destructive'
    if (utilization >= 80) return 'default'
    if (utilization >= 60) return 'secondary'
    return 'outline'
  }
  
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Staff Utilization</h3>
        <p className="text-sm text-muted-foreground">Hours worked vs available hours</p>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Staff Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Hours Worked</TableHead>
            <TableHead className="text-right">Available Hours</TableHead>
            <TableHead className="text-right">Utilization</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {utilizationData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground h-32">
                No utilization data available
              </TableCell>
            </TableRow>
          ) : (
            utilizationData.slice(0, 15).map((staff) => (
              <TableRow key={staff.staff_id}>
                <TableCell className="font-medium">{staff.staff_name}</TableCell>
                <TableCell className="capitalize">{staff.role}</TableCell>
                <TableCell className="text-right">{formatNumber(staff.hours, 1)}</TableCell>
                <TableCell className="text-right">{formatNumber(staff.available)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={getUtilizationColor(staff.utilization)}>
                    {formatNumber(staff.utilization, 1)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  )
}
