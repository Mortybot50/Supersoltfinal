import { useState } from 'react'
import { useLabourMetrics } from '@/lib/hooks/useLabourMetrics'
import { DateRangeSelector } from '@/components/DateRangeSelector'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { LabourKPICards } from './labour/components/LabourKPICards'
import { LabourTrendChart } from './labour/components/LabourTrendChart'
import { EfficiencyMetrics } from './labour/components/EfficiencyMetrics'
import { RosterVsActual } from './labour/components/RosterVsActual'
import { OvertimeAnalysis } from './labour/components/OvertimeAnalysis'
import { CostByRole } from './labour/components/CostByRole'
import { StaffUtilization } from './labour/components/StaffUtilization'
import { ComplianceAlerts } from './labour/components/ComplianceAlerts'
import { OptimizationOpportunities } from './labour/components/OptimizationOpportunities'

export default function Labour() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  })
  
  const metrics = useLabourMetrics({ dateRange })
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Labour Insights</h1>
          <p className="text-muted-foreground">
            Labour cost analysis and workforce efficiency
          </p>
        </div>
        
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>
      
      {/* Date Range Selector */}
      <DateRangeSelector 
        onDateRangeChange={(start, end) => setDateRange({ startDate: start, endDate: end })}
      />
      
      {/* KPI Cards */}
      <LabourKPICards metrics={metrics} />
      
      {/* Trend Chart */}
      <LabourTrendChart />
      
      {/* Efficiency Metrics */}
      <EfficiencyMetrics />
      
      {/* Roster vs Actual */}
      <RosterVsActual />
      
      {/* Overtime Analysis */}
      <OvertimeAnalysis />
      
      {/* Cost by Role */}
      <CostByRole />
      
      {/* Staff Utilization */}
      <StaffUtilization />
      
      {/* Compliance Alerts */}
      <ComplianceAlerts />
      
      {/* Optimization Opportunities */}
      <OptimizationOpportunities />
    </div>
  )
}
