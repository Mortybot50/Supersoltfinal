import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { calculateSupplierPerformance } from '@/lib/utils/cogsCalculations'
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters'

export function SupplierPerformance() {
  const { purchaseOrders, suppliers, isLoading } = useDataStore()
  
  const supplierStats = useMemo(() => {
    if (isLoading || suppliers.length === 0) return []
    
    return calculateSupplierPerformance(purchaseOrders, suppliers)
  }, [purchaseOrders, suppliers, isLoading])
  
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="w-4 h-4 text-destructive" />
      case 'decreasing': return <TrendingDown className="w-4 h-4 text-green-600" />
      default: return <Minus className="w-4 h-4 text-muted-foreground" />
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplier Performance</CardTitle>
        <p className="text-sm text-muted-foreground">
          Purchase volume and reliability metrics
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Total Purchases</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Share</TableHead>
              <TableHead className="text-right">Reliability</TableHead>
              <TableHead className="text-right">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplierStats.map(supplier => (
              <TableRow key={supplier.supplier_id}>
                <TableCell className="font-medium">
                  {supplier.supplier_name}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(supplier.total_purchases)}
                </TableCell>
                <TableCell className="text-right">
                  {supplier.purchase_order_count}
                </TableCell>
                <TableCell className="text-right">
                  {formatPercentage(supplier.share_of_total_purchases)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={
                    supplier.reliability_score >= 90 ? 'default' : 
                    supplier.reliability_score >= 75 ? 'secondary' : 
                    'destructive'
                  }>
                    {supplier.reliability_score.toFixed(0)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {getTrendIcon(supplier.price_trend)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
