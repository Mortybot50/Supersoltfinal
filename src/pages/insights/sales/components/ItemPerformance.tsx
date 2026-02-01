import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ItemPerformance as ItemPerformanceType } from '../types/sales.types'
import { formatCurrency, formatNumber, formatPercentage, getVarianceColor } from '../utils/formatters'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ItemPerformanceProps {
  items: ItemPerformanceType[]
}

export function ItemPerformance({ items }: ItemPerformanceProps) {
  const [sortBy, setSortBy] = useState<'revenue' | 'qty' | 'growth'>('revenue')
  const [showCount, setShowCount] = useState(10)
  
  const sortedItems = [...items].sort((a, b) => {
    switch (sortBy) {
      case 'revenue':
        return b.revenue - a.revenue
      case 'qty':
        return b.qty_sold - a.qty_sold
      case 'growth':
        const aGrowth = a.growth_pct ?? -Infinity
        const bGrowth = b.growth_pct ?? -Infinity
        return bGrowth - aGrowth
      default:
        return 0
    }
  })
  
  const displayItems = sortedItems.slice(0, showCount)
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Item Performance</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'revenue' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('revenue')}
            >
              Revenue
            </Button>
            <Button
              variant={sortBy === 'qty' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('qty')}
            >
              Quantity
            </Button>
            <Button
              variant={sortBy === 'growth' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('growth')}
            >
              Growth
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Rank</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">Growth</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayItems.map((item, index) => (
                <TableRow key={item.item_id}>
                  <TableCell className="font-medium">#{index + 1}</TableCell>
                  <TableCell className="font-medium">{item.item_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.menu_group}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(item.qty_sold)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.revenue)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.share_pct.toFixed(1)}%
                  </TableCell>
                  <TableCell className={`text-right ${getVarianceColor(item.growth_pct)}`}>
                    {formatPercentage(item.growth_pct)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.margin_pct.toFixed(0)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {sortedItems.length > showCount && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              onClick={() => setShowCount(prev => prev + 10)}
            >
              Show More ({sortedItems.length - showCount} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
