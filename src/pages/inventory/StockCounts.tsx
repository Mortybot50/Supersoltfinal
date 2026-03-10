import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  Plus,
  Search,
  Eye,
  Calendar,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { StockCountItem } from '@/types'
import { format, subDays, startOfMonth, isAfter } from 'date-fns'
import { PageShell, PageToolbar } from '@/components/shared'
import { StatCards } from '@/components/ui/StatCards'
import { SecondaryStats } from '@/components/ui/SecondaryStats'
import { formatCurrency } from '@/lib/utils/formatters'

export default function StockCounts() {
  const navigate = useNavigate()
  const { stockCounts, suppliers, isLoading, loadStockCountsFromDB } = useDataStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')

  useEffect(() => {
    loadStockCountsFromDB()
  }, [loadStockCountsFromDB])

  // Filter counts
  const filteredCounts = useMemo(() => {
    let filtered = stockCounts

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (sc) =>
          sc.count_number.toLowerCase().includes(query) ||
          sc.counted_by_name?.toLowerCase().includes(query)
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((sc) => sc.status === statusFilter)
    }

    // Date range filter
    if (dateFilter !== 'all') {
      const now = new Date()
      let startDate: Date
      switch (dateFilter) {
        case 'week':
          startDate = subDays(now, 7)
          break
        case 'month':
          startDate = startOfMonth(now)
          break
        case '3months':
          startDate = subDays(now, 90)
          break
        default:
          startDate = new Date(0)
      }
      filtered = filtered.filter((sc) => isAfter(new Date(sc.count_date), startDate))
    }

    return filtered.sort(
      (a, b) => new Date(b.count_date).getTime() - new Date(a.count_date).getTime()
    )
  }, [stockCounts, searchQuery, statusFilter, dateFilter])

  // Stats
  const stats = useMemo(() => {
    const total = stockCounts.length
    const inProgress = stockCounts.filter((sc) => sc.status === 'in-progress').length
    const completed = stockCounts.filter((sc) => sc.status === 'completed' || sc.status === 'reviewed').length

    const completedCounts = stockCounts.filter((sc) => sc.status === 'completed' || sc.status === 'reviewed')
    const totalVariance = completedCounts.reduce(
      (sum, sc) => sum + sc.total_variance_value,
      0
    )
    const totalValue = completedCounts.reduce(
      (sum, sc) => sum + (sc.total_count_value || 0),
      0
    )

    return { total, inProgress, completed, totalVariance, totalValue }
  }, [stockCounts])

  const toolbar = (
    <PageToolbar
      title="Stock Counts"
      filters={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[180px] pl-8 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
      primaryAction={{ label: "New Count", icon: Plus, onClick: () => navigate('/inventory/stock-counts/new'), variant: "primary" }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <StatCards stats={[
          { label: "Total", value: stats.total },
          { label: "In Progress", value: stats.inProgress },
          { label: "Completed", value: stats.completed },
        ]} columns={3} />
        <SecondaryStats stats={[
          { label: "Total Value", value: `$${(stats.totalValue / 100).toFixed(0)}` },
          { label: "Variance", value: `${stats.totalVariance >= 0 ? '+' : ''}${formatCurrency(stats.totalVariance)}` },
        ]} />
      </div>
      <div className="p-4">
      {isLoading && stockCounts.length === 0 ? (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
          <p className="text-muted-foreground">Loading stock counts...</p>
        </Card>
      ) : filteredCounts.length === 0 ? (
        <Card className="p-12 text-center">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {stockCounts.length === 0 ? 'No Stock Counts Yet' : 'No Counts Found'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {stockCounts.length === 0
              ? 'Create your first stock count to track inventory'
              : 'Try adjusting your filters'}
          </p>
          {stockCounts.length === 0 && (
            <Button onClick={() => navigate('/inventory/stock-counts/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Count
            </Button>
          )}
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Count Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Variance $</TableHead>
                <TableHead>Counted By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCounts.map((count) => (
                <TableRow
                  key={count.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/inventory/stock-counts/${count.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{count.count_number}</span>
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(count.count_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {count.count_type || 'full'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{count.items?.length || 0} items</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {count.total_count_value
                      ? formatCurrency(count.total_count_value)
                      : '—'}
                  </TableCell>
                  <TableCell>
                    {count.status === 'completed' || count.status === 'reviewed' ? (
                      <span
                        className={`font-semibold ${
                          count.total_variance_value >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {count.total_variance_value >= 0 ? '+' : ''}$
                        {(Math.abs(count.total_variance_value) / 100).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{count.counted_by_name || count.counted_by_user_id}</TableCell>
                  <TableCell>
                    {count.status === 'in-progress' && (
                      <Badge variant="secondary">In Progress</Badge>
                    )}
                    {count.status === 'completed' && (
                      <Badge className="bg-blue-600">Completed</Badge>
                    )}
                    {count.status === 'reviewed' && (
                      <Badge className="bg-green-600">Reviewed</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation() }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      </div>
    </PageShell>
  )
}
