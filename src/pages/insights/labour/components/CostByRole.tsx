import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { calculateRoleBreakdown } from '@/lib/utils/labourCalculations'
import { formatCurrency, formatNumber } from '@/lib/utils/formatters'

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a']

export function CostByRole() {
  const { timesheets, staff } = useDataStore()
  
  const roleBreakdown = useMemo(() => 
    calculateRoleBreakdown(timesheets, staff),
    [timesheets, staff]
  )
  
  const chartData = roleBreakdown.map((role, index) => ({
    name: role.role,
    value: role.total_cost / 100,
    fill: COLORS[index % COLORS.length]
  }))
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Labour Cost by Role</h3>
          <p className="text-sm text-muted-foreground">Distribution across positions</p>
        </div>
        
        {roleBreakdown.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No role data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
      
      <Card className="p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Role Breakdown</h3>
          <p className="text-sm text-muted-foreground">Detailed metrics by role</p>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Staff</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roleBreakdown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground h-32">
                  No role data available
                </TableCell>
              </TableRow>
            ) : (
              roleBreakdown.map((role) => (
                <TableRow key={role.role}>
                  <TableCell className="font-medium capitalize">{role.role}</TableCell>
                  <TableCell className="text-right">{role.staff_count}</TableCell>
                  <TableCell className="text-right">{formatNumber(role.total_hours, 1)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(role.total_cost)}</TableCell>
                  <TableCell className="text-right">{role.share_of_total_cost.toFixed(1)}%</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
