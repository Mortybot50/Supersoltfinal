import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lightbulb, TrendingDown, Package, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatters'

const opportunities = [
  {
    title: 'Reduce High-Waste Items',
    description: 'Top 5 wasted ingredients account for $850/week in losses. Consider smaller order quantities or alternative uses.',
    potential_saving: 350000, // cents per month
    impact: 'high',
    icon: Trash2,
    action: 'Review Waste Logs'
  },
  {
    title: 'Negotiate Supplier Pricing',
    description: 'Supplier A prices are 12% above market average. Potential to renegotiate or switch suppliers.',
    potential_saving: 280000,
    impact: 'high',
    icon: TrendingDown,
    action: 'Compare Suppliers'
  },
  {
    title: 'Optimize Order Quantities',
    description: 'Ordering patterns suggest over-purchasing on 8 items. Reduce order guide quantities.',
    potential_saving: 180000,
    impact: 'medium',
    icon: Package,
    action: 'Adjust Order Guide'
  },
  {
    title: 'Recipe Cost Optimization',
    description: '3 popular menu items have COGS above target. Consider portion adjustments or ingredient substitutions.',
    potential_saving: 220000,
    impact: 'medium',
    icon: Lightbulb,
    action: 'Review Recipes'
  }
]

export function CostSavingOpportunities() {
  const totalSavings = opportunities.reduce((sum, opp) => sum + opp.potential_saving, 0)
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cost-Saving Opportunities</CardTitle>
            <p className="text-sm text-muted-foreground">
              AI-identified potential savings: {formatCurrency(totalSavings)}/month
            </p>
          </div>
          <Lightbulb className="w-8 h-8 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {opportunities.map((opp, idx) => (
            <div 
              key={idx}
              className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="p-2 rounded-lg bg-primary/10">
                <opp.icon className="w-5 h-5 text-primary" />
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold">{opp.title}</h4>
                  <Badge variant={opp.impact === 'high' ? 'default' : 'secondary'}>
                    {opp.impact} impact
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  {opp.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Potential savings: </span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(opp.potential_saving)}/mo
                    </span>
                  </div>
                  
                  <Button size="sm" variant="outline">
                    {opp.action}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
