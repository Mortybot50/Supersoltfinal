import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { calculateCategoryBreakdown } from '@/lib/utils/cogsCalculations'
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters'

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

export function CategoryBreakdown() {
  const { ingredients, isLoading } = useDataStore()
  
  const categories = useMemo(() => {
    if (isLoading || ingredients.length === 0) return []
    
    return calculateCategoryBreakdown(ingredients, 50000, 55000)
  }, [ingredients, isLoading])
  
  const chartData = categories.map(cat => ({
    name: cat.category,
    value: cat.actual_cogs / 100
  }))
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>COGS by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.percent ? formatPercentage(entry.percent) : '0%'}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value * 100)} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Category Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(cat => (
                <TableRow key={cat.category}>
                  <TableCell className="font-medium">{cat.category}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(cat.actual_cogs)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={cat.variance > 0 ? 'destructive' : 'default'}>
                      {formatPercentage(cat.variance_percent)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercentage(cat.share_of_total_cogs)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
