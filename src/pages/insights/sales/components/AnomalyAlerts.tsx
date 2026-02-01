import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Anomaly } from '../types/sales.types'
import { formatCurrency, formatDate, getSeverityColor } from '../utils/formatters'
import { AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react'

interface AnomalyAlertsProps {
  anomalies: Anomaly[]
}

export function AnomalyAlerts({ anomalies }: AnomalyAlertsProps) {
  if (anomalies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anomaly Detection</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>All Clear</AlertTitle>
            <AlertDescription>
              No significant anomalies detected in the selected period. Sales performance is within expected ranges.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomaly Detection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {anomalies.slice(0, 5).map((anomaly, index) => (
          <Alert key={index} variant={anomaly.severity === 'high' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              <span>{formatDate(new Date(anomaly.date))}</span>
              <Badge className={getSeverityColor(anomaly.severity)}>
                {anomaly.severity}
              </Badge>
              <span className="text-sm font-normal text-muted-foreground">
                {anomaly.location_id}
              </span>
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                {anomaly.variance_pct < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                )}
                <span>
                  <strong>{Math.abs(anomaly.variance_pct).toFixed(1)}%</strong> variance from expected
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Actual: </span>
                  <span className="font-medium">{formatCurrency(anomaly.actual)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Expected: </span>
                  <span className="font-medium">{formatCurrency(anomaly.expected)}</span>
                </div>
              </div>
              {anomaly.suspected_cause && (
                <div className="text-sm bg-muted/50 rounded p-2 mt-2">
                  <strong>Suspected cause:</strong> {anomaly.suspected_cause}
                </div>
              )}
            </AlertDescription>
          </Alert>
        ))}
        
        {anomalies.length > 5 && (
          <p className="text-sm text-muted-foreground text-center">
            + {anomalies.length - 5} more anomalies detected
          </p>
        )}
      </CardContent>
    </Card>
  )
}
