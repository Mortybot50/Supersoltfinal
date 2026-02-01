import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefundMetrics } from '../types/sales.types'
import { formatCurrency } from '../utils/formatters'
import { AlertCircle } from 'lucide-react'

interface RefundsMonitorProps {
  refundMetrics: RefundMetrics
}

export function RefundsMonitor({ refundMetrics }: RefundsMonitorProps) {
  const hasHighRefundRate = refundMetrics.refund_rate_pct > 3
  const hasHighVoidRate = refundMetrics.void_rate_pct > 2
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Refunds & Voids Monitor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(hasHighRefundRate || hasHighVoidRate) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {hasHighRefundRate && `Refund rate (${refundMetrics.refund_rate_pct.toFixed(1)}%) is above threshold. `}
              {hasHighVoidRate && `Void rate (${refundMetrics.void_rate_pct.toFixed(1)}%) is above threshold.`}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Refund Rate</p>
            <p className="text-2xl font-bold mt-1">
              {refundMetrics.refund_rate_pct.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              of all transactions
            </p>
          </div>
          
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Refund Value</p>
            <p className="text-2xl font-bold mt-1">
              {formatCurrency(refundMetrics.total_refund_value)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {refundMetrics.refund_value_pct.toFixed(1)}% of sales
            </p>
          </div>
          
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Void Rate</p>
            <p className="text-2xl font-bold mt-1">
              {refundMetrics.void_rate_pct.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {refundMetrics.total_void_count} voided orders
            </p>
          </div>
        </div>
        
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium mb-2">Health Indicators</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Refund Rate Target:</span>
              <span className={refundMetrics.refund_rate_pct <= 3 ? 'text-green-600' : 'text-red-600'}>
                {refundMetrics.refund_rate_pct <= 3 ? '✓ Within target (≤3%)' : '✗ Above target (>3%)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Void Rate Target:</span>
              <span className={refundMetrics.void_rate_pct <= 2 ? 'text-green-600' : 'text-red-600'}>
                {refundMetrics.void_rate_pct <= 2 ? '✓ Within target (≤2%)' : '✗ Above target (>2%)'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
