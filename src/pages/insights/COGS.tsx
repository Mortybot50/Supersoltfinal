import { useState } from 'react'
import { useCOGSMetrics } from '@/lib/hooks/useCOGSMetrics'
import { DateRangeSelector } from '@/components/DateRangeSelector'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { COGSKPICards } from './cogs/components/COGSKPICards'
import { COGSTrendChart } from './cogs/components/COGSTrendChart'
import { CategoryBreakdown } from './cogs/components/CategoryBreakdown'
import { TheoreticalVsActual } from './cogs/components/TheoreticalVsActual'
import { SupplierPerformance } from './cogs/components/SupplierPerformance'
import { WasteImpact } from './cogs/components/WasteImpact'
import { TopCostItems } from './cogs/components/TopCostItems'
import { VarianceAlerts } from './cogs/components/VarianceAlerts'
import { CostSavingOpportunities } from './cogs/components/CostSavingOpportunities'
import { subDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'

export default function COGS() {
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date()
  })
  
  const metrics = useCOGSMetrics({ dateRange })
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">COGS Insights</h1>
          <p className="text-muted-foreground">
            Cost of Goods Sold analysis and variance tracking
          </p>
        </div>
        
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>
      
      {/* Date Range Selector */}
      <DateRangeSelector
        onDateRangeChange={(start, end) => {
          setDateRange({ startDate: start, endDate: end })
        }}
      />
      
      {/* KPI Cards */}
      <COGSKPICards metrics={metrics || {
        actual_cogs: 0,
        actual_cogs_percent: 0,
        target_cogs_percent: 28,
        theoretical_cogs: 0,
        theoretical_cogs_percent: 0,
        total_waste_value: 0,
        variance: 0,
        variance_percent: 0,
        waste_percent_of_cogs: 0,
        vs_previous_period: {
          cogs_change: 0,
          cogs_percent_change: 0
        },
        vs_target: {
          on_track: false,
          variance: 0
        }
      }} />
      
      {/* Trend Chart */}
      <COGSTrendChart />
      
      {/* Category Breakdown */}
      <CategoryBreakdown />
      
      {/* Theoretical vs Actual */}
      <TheoreticalVsActual />
      
      {/* Supplier Performance */}
      <SupplierPerformance />
      
      {/* Waste Impact */}
      <WasteImpact />
      
      {/* Top Cost Items */}
      <TopCostItems />
      
      {/* Variance Alerts */}
      <VarianceAlerts />
      
      {/* Cost-Saving Opportunities */}
      <CostSavingOpportunities />
    </div>
  )
}
