import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingDown, TrendingUp, DollarSign, Clock, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/utils/formatters'
import type { LabourMetrics } from '@/types'

interface LabourKPICardsProps {
  metrics: LabourMetrics | null
}

export function LabourKPICards({ metrics }: LabourKPICardsProps) {
  const labourPercent = metrics?.labour_percent || 0
  const totalCost = metrics?.total_cost || 0
  const totalHours = metrics?.total_hours || 0
  const targetPercent = 25
  const variance = labourPercent - targetPercent
  const onTrack = labourPercent <= targetPercent * 1.05
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Labour % Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Labour %</span>
          {labourPercent > targetPercent ? (
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <TrendingDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {labourPercent.toFixed(1)}%
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={onTrack ? 'default' : 'destructive'}>
            {onTrack ? 'On Target' : 'Over Target'}
          </Badge>
          <span className="text-muted-foreground">
            vs {targetPercent.toFixed(1)}% target
          </span>
        </div>
      </Card>
      
      {/* Total Labour Cost Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Total Labour Cost</span>
          <DollarSign className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {formatCurrency(totalCost)}
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">
            {variance.toFixed(1)}%
          </Badge>
          <span className="text-muted-foreground">
            vs budget
          </span>
        </div>
      </Card>
      
      {/* Total Hours Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Total Hours</span>
          <Clock className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {formatNumber(totalHours, 1)}
        </div>
        
        <div className="text-sm text-muted-foreground">
          {metrics?.staff_count || 0} staff members
        </div>
      </Card>
      
      {/* Overtime Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Overtime</span>
          <AlertTriangle className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="text-3xl font-bold mb-1">
          {formatCurrency(0)}
        </div>
        
        <div className="text-sm text-muted-foreground">
          {formatNumber(0, 1)} hours (0.0%)
        </div>
      </Card>
    </div>
  )
}
