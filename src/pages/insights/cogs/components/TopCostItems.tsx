import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { formatCurrency } from '@/lib/utils/formatters'

export function TopCostItems() {
  const { ingredients, isLoading } = useDataStore()
  
  const topItems = useMemo(() => {
    if (isLoading || ingredients.length === 0) return []
    
    return [...ingredients]
      .sort((a, b) => (b.current_stock * b.cost_per_unit) - (a.current_stock * a.cost_per_unit))
      .slice(0, 10)
      .map(ing => ({
        name: ing.name,
        category: ing.category,
        stock_value: ing.current_stock * ing.cost_per_unit,
        unit_cost: ing.cost_per_unit,
        trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable'
      }))
  }, [ingredients, isLoading])
  
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-destructive" />
      case 'down': return <TrendingDown className="w-4 h-4 text-green-600" />
      default: return <Minus className="w-4 h-4 text-muted-foreground" />
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Cost Items</CardTitle>
        <p className="text-sm text-muted-foreground">
          Highest value ingredients by current stock
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock Value</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topItems.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.category}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.stock_value)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.unit_cost)}
                </TableCell>
                <TableCell className="text-right">
                  {getTrendIcon(item.trend)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
