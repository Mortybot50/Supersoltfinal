import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { detectCOGSAnomalies } from '@/lib/utils/cogsCalculations'
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters'
import { format } from 'date-fns'

export function VarianceAlerts() {
  const { ingredients, wasteLogs, purchaseOrders, isLoading } = useDataStore()
  
  const anomalies = useMemo(() => {
    if (isLoading) return []
    
    return detectCOGSAnomalies(ingredients, wasteLogs, purchaseOrders)
  }, [ingredients, wasteLogs, purchaseOrders, isLoading])
  
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <AlertTriangle className="w-5 h-5 text-destructive" />
      case 'medium': return <AlertCircle className="w-5 h-5 text-orange-600" />
      default: return <Info className="w-5 h-5 text-blue-600" />
    }
  }
  
  const getSeverityVariant = (severity: string): "default" | "destructive" | "secondary" => {
    switch (severity) {
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      default: return 'default'
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Variance Alerts</CardTitle>
        <p className="text-sm text-muted-foreground">
          Detected anomalies and high-variance items
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {anomalies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No significant variances detected
            </p>
          ) : (
            anomalies.map((anomaly, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="mt-0.5">
                  {getSeverityIcon(anomaly.severity)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{anomaly.ingredient_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(anomaly.date, 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <Badge variant={getSeverityVariant(anomaly.severity)}>
                      {anomaly.severity}
                    </Badge>
                  </div>
                  <p className="text-sm">
                    {anomaly.suspected_cause}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Expected: {formatCurrency(anomaly.expected_value)}</span>
                    <span>Actual: {formatCurrency(anomaly.actual_value)}</span>
                    <span className="text-destructive font-medium">
                      {formatPercentage(anomaly.variance_percent)} variance
                    </span>
                  </div>
                  <p className="text-sm text-primary">
                    💡 {anomaly.suggested_action}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
