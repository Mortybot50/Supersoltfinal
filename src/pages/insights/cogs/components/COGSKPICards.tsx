import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingDown, TrendingUp, AlertTriangle, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'
import type { COGSMetrics } from '@/types/cogs.types'

interface COGSKPICardsProps {
  metrics: COGSMetrics
}

export function COGSKPICards({ metrics }: COGSKPICardsProps) {
  // Use default zero values if metrics is null
  const safeMetrics = metrics || {
    actual_cogs_percent: 0,
    target_cogs_percent: 28,
    variance: 0,
    variance_percent: 0,
    theoretical_cogs: 0,
    theoretical_cogs_percent: 0,
    total_waste_value: 0,
    waste_percent_of_cogs: 0,
    vs_target: {
      variance: 0,
      on_track: false
    }
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Actual COGS % Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Actual COGS %</span>
          {safeMetrics.actual_cogs_percent > safeMetrics.target_cogs_percent ? (
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <TrendingDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {safeMetrics.actual_cogs_percent.toFixed(1)}%
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={
            safeMetrics.actual_cogs_percent <= safeMetrics.target_cogs_percent 
              ? 'default' 
              : 'destructive'
          }>
            {safeMetrics.vs_target.on_track ? 'On Target' : 'Over Target'}
          </Badge>
          <span className="text-muted-foreground">
            vs {safeMetrics.target_cogs_percent.toFixed(1)}% target
          </span>
        </div>
      </Card>
      
      {/* Variance Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Variance</span>
          <AlertTriangle className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {formatCurrency(Math.abs(safeMetrics.variance))}
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={
            Math.abs(safeMetrics.variance_percent) < 5 
              ? 'default' 
              : 'destructive'
          }>
            {Math.abs(safeMetrics.variance_percent).toFixed(1)}%
          </Badge>
          <span className="text-muted-foreground">
            {safeMetrics.variance > 0 ? 'Over' : 'Under'} theoretical
          </span>
        </div>
      </Card>
      
      {/* Theoretical COGS Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Theoretical COGS</span>
          <Target className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {formatCurrency(safeMetrics.theoretical_cogs)}
        </div>
        
        <div className="text-sm text-muted-foreground">
          {safeMetrics.theoretical_cogs_percent.toFixed(1)}% of sales
        </div>
      </Card>
      
      {/* Waste Impact Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Waste Impact</span>
          <AlertTriangle className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {formatCurrency(safeMetrics.total_waste_value)}
        </div>
        
        <div className="text-sm text-muted-foreground">
          {safeMetrics.waste_percent_of_cogs.toFixed(1)}% of COGS
        </div>
      </Card>
    </div>
  )
}
