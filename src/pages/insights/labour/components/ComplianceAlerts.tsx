import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { useDataStore } from '@/lib/store/dataStore'
import { useMemo } from 'react'
import { checkRosterCompliance } from '@/lib/utils/labourCalculations'
import { format } from 'date-fns'

export function ComplianceAlerts() {
  const { timesheets, rosterShifts, staff } = useDataStore()
  
  const compliance = useMemo(() => 
    checkRosterCompliance(rosterShifts, timesheets, staff),
    [rosterShifts, timesheets, staff]
  )
  
  const getSeverityIcon = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return <AlertTriangle className="w-4 h-4 text-red-600" />
      case 'medium': return <Info className="w-4 h-4 text-orange-600" />
      case 'low': return <Info className="w-4 h-4 text-blue-600" />
    }
  }
  
  const getSeverityVariant = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
    }
  }
  
  return (
    <Card className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="text-lg font-semibold">Fair Work Compliance</h3>
            <p className="text-sm text-muted-foreground">Regulatory compliance alerts</p>
          </div>
          {compliance.issues.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">All Clear</span>
            </div>
          ) : (
            <Badge variant="destructive">
              {compliance.issues.length} Issues
            </Badge>
          )}
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="border rounded-lg p-3">
            <div className="text-sm text-muted-foreground">Total Shifts</div>
            <div className="text-2xl font-bold">{compliance.total_shifts}</div>
          </div>
          
          <div className="border rounded-lg p-3">
            <div className="text-sm text-muted-foreground">Published</div>
            <div className="text-2xl font-bold text-green-600">{compliance.published_shifts}</div>
          </div>
          
          <div className="border rounded-lg p-3">
            <div className="text-sm text-muted-foreground">With Issues</div>
            <div className="text-2xl font-bold text-red-600">{compliance.shifts_with_issues}</div>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        {compliance.issues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-600" />
            <p className="font-semibold">No compliance issues detected</p>
            <p className="text-sm">All shifts meet Fair Work requirements</p>
          </div>
        ) : (
          compliance.issues.map((issue, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getSeverityIcon(issue.severity)}
                  <div>
                    <div className="font-semibold">{issue.staff_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(issue.shift_date), 'dd MMM yyyy')}
                    </div>
                  </div>
                </div>
                <Badge variant={getSeverityVariant(issue.severity)}>
                  {issue.severity}
                </Badge>
              </div>
              
              <div className="space-y-2 ml-6">
                <p className="text-sm">{issue.description}</p>
                <p className="text-xs text-muted-foreground">
                  <strong>Reference:</strong> {issue.fair_work_reference}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    <strong>Action:</strong> {issue.suggested_action}
                  </p>
                  <Button size="sm" variant="outline">
                    Resolve
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
