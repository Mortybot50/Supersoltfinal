import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { calculateWasteImpact } from '@/lib/utils/cogsCalculations'
import { formatCurrency } from '@/lib/utils/formatters'

export function WasteImpact() {
  const { wasteLogs, isLoading } = useDataStore()
  
  const wasteData = useMemo(() => {
    if (isLoading) return null
    
    return calculateWasteImpact(wasteLogs, 50000)
  }, [wasteLogs, isLoading])
  
  if (!wasteData) return null
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Top Wasted Items</CardTitle>
          <p className="text-sm text-muted-foreground">
            Highest value waste contributors
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wasteData.top_wasted_items.slice(0, 5).map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">
                    {item.ingredient_name}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.waste_value)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.primary_reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Waste by Category</CardTitle>
          <p className="text-sm text-muted-foreground">
            Category-level waste breakdown
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Top Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wasteData.waste_by_category.map((cat, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">
                    {cat.category}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(cat.waste_value)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cat.top_reason}
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
