import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Award } from 'lucide-react'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { calculateLabourEfficiency } from '@/lib/utils/labourCalculations'
import { formatCurrency, formatNumber } from '@/lib/utils/formatters'

export function EfficiencyMetrics() {
  const { timesheets, orders } = useDataStore()
  
  const efficiency = useMemo(() => 
    calculateLabourEfficiency(timesheets, orders),
    [timesheets, orders]
  )
  
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800'
      case 'B': return 'bg-blue-100 text-blue-800'
      case 'C': return 'bg-yellow-100 text-yellow-800'
      case 'D': return 'bg-orange-100 text-orange-800'
      case 'F': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  
  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold">Efficiency Metrics</h3>
          <p className="text-sm text-muted-foreground">Productivity analysis</p>
        </div>
        <Badge className={getGradeColor(efficiency.performance_grade)}>
          Grade: {efficiency.performance_grade}
        </Badge>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Sales per Labour Hour</span>
          </div>
          <div className="text-2xl font-bold">
            {formatCurrency(efficiency.sales_per_labour_hour)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Benchmark: {formatCurrency(efficiency.industry_benchmark_sales_per_lh)}
          </div>
        </div>
        
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Sales per Labour Dollar</span>
          </div>
          <div className="text-2xl font-bold">
            ${formatNumber(efficiency.sales_per_labour_dollar, 2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Revenue efficiency
          </div>
        </div>
        
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Transactions per Hour</span>
          </div>
          <div className="text-2xl font-bold">
            {formatNumber(efficiency.transactions_per_labour_hour, 1)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Service speed
          </div>
        </div>
        
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">Staff Utilization</span>
          </div>
          <div className="text-2xl font-bold">
            {formatNumber(efficiency.staff_utilization_percent, 1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Productivity rate
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          Variance vs Industry Benchmark: 
          <span className={efficiency.variance_vs_benchmark >= 0 ? 'text-green-600 font-semibold ml-2' : 'text-red-600 font-semibold ml-2'}>
            {efficiency.variance_vs_benchmark >= 0 ? '+' : ''}{formatNumber(efficiency.variance_vs_benchmark, 1)}%
          </span>
        </div>
      </div>
    </Card>
  )
}
