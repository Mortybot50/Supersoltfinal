import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lightbulb, TrendingDown, Users, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'

export function OptimizationOpportunities() {
  const opportunities = [
    {
      id: 1,
      title: 'Reduce Overtime Hours',
      description: 'Optimize roster to reduce overtime by scheduling more part-time staff during peak periods.',
      potential_savings: 450000,
      impact: 'high',
      icon: Clock,
      action: 'Review Roster'
    },
    {
      id: 2,
      title: 'Balance Staff Distribution',
      description: 'Redistribute staff across shifts to improve coverage during peak lunch period.',
      potential_savings: 280000,
      impact: 'medium',
      icon: Users,
      action: 'Adjust Schedule'
    },
    {
      id: 3,
      title: 'Reduce Labour % Variance',
      description: 'Current labour % is 2.5% above target. Focus on efficiency during low-sales periods.',
      potential_savings: 320000,
      impact: 'high',
      icon: TrendingDown,
      action: 'View Analysis'
    }
  ]
  
  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'destructive'
      case 'medium': return 'secondary'
      case 'low': return 'outline'
      default: return 'outline'
    }
  }
  
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Lightbulb className="w-5 h-5 text-yellow-600" />
        <div>
          <h3 className="text-lg font-semibold">Optimization Opportunities</h3>
          <p className="text-sm text-muted-foreground">AI-powered suggestions to reduce labour costs</p>
        </div>
      </div>
      
      <div className="space-y-4">
        {opportunities.map((opportunity) => {
          const Icon = opportunity.icon
          return (
            <div key={opportunity.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{opportunity.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {opportunity.description}
                    </p>
                  </div>
                </div>
                <Badge variant={getImpactColor(opportunity.impact)}>
                  {opportunity.impact} impact
                </Badge>
              </div>
              
              <div className="flex items-center justify-between ml-11">
                <div>
                  <span className="text-sm text-muted-foreground">Potential Savings:</span>
                  <span className="text-lg font-bold text-green-600 ml-2">
                    {formatCurrency(opportunity.potential_savings)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">per month</span>
                </div>
                <Button size="sm">
                  {opportunity.action}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="mt-6 pt-6 border-t">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Total Monthly Savings Potential</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(opportunities.reduce((sum, o) => sum + o.potential_savings, 0))}
            </div>
          </div>
          <Button>View All Opportunities</Button>
        </div>
      </div>
    </Card>
  )
}
