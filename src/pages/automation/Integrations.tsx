import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Bell, Zap } from 'lucide-react'
import { PageShell, PageToolbar } from '@/components/shared'

const INTEGRATIONS = [
  {
    id: 'square',
    name: 'Square POS',
    description: 'Sync sales, menu items, and transactions directly from Square. Auto-import daily sales data and keep your menu in sync.',
    category: 'Point of Sale',
    features: ['Real-time sales sync', 'Menu item sync', 'Transaction history', 'Modifier mapping'],
    logo: 'SQ',
    color: 'bg-black text-white',
  },
  {
    id: 'lightspeed',
    name: 'Lightspeed',
    description: 'Connect Lightspeed Restaurant POS for automatic sales import, menu management, and reporting integration.',
    category: 'Point of Sale',
    features: ['Sales data import', 'Menu sync', 'Inventory tracking', 'Staff management'],
    logo: 'LS',
    color: 'bg-red-600 text-white',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Export purchase orders, invoices, and payroll data directly to Xero. Streamline your accounting workflow.',
    category: 'Accounting',
    features: ['Invoice export', 'PO sync', 'Payroll journal entries', 'Chart of accounts mapping'],
    logo: 'XE',
    color: 'bg-[#13B5EA] text-white',
  },
  {
    id: 'myob',
    name: 'MYOB',
    description: 'Sync financial data with MYOB Business for seamless Australian accounting. Export invoices, POs, and payroll.',
    category: 'Accounting',
    features: ['Invoice sync', 'Purchase order export', 'BAS preparation data', 'Payroll integration'],
    logo: 'MY',
    color: 'bg-purple-700 text-white',
  },
  {
    id: 'keypay',
    name: 'KeyPay (Employment Hero)',
    description: 'Integrate timesheets and roster data with KeyPay for award interpretation, STP compliance, and payroll processing.',
    category: 'Payroll',
    features: ['Timesheet export', 'Award interpretation', 'STP reporting', 'Leave management'],
    logo: 'KP',
    color: 'bg-green-600 text-white',
  },
  {
    id: 'deputy',
    name: 'Deputy',
    description: 'Sync rosters and timesheets with Deputy for scheduling, time tracking, and workforce management.',
    category: 'Workforce',
    features: ['Roster sync', 'Timesheet import', 'Leave requests', 'Award compliance'],
    logo: 'DP',
    color: 'bg-blue-600 text-white',
  },
]

export default function Integrations() {
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set())

  const handleNotify = (id: string, name: string) => {
    setNotifiedIds(prev => new Set([...prev, id]))
    toast.success(`We'll notify you when ${name} is available`)
  }

  const categories = [...new Set(INTEGRATIONS.map(i => i.category))]

  const toolbar = (
    <PageToolbar title="Integrations" />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-6 space-y-6">
      {/* Status Banner */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-blue-100">
            <Zap className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Integrations Coming Soon</h3>
            <p className="text-muted-foreground mt-1">
              We're building native integrations with Australia's most popular hospitality tools.
              Register your interest below and we'll notify you when each integration is ready.
            </p>
          </div>
        </div>
      </Card>

      {/* Integration Cards by Category */}
      {categories.map(category => (
        <div key={category}>
          <h2 className="text-lg font-semibold mb-3">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {INTEGRATIONS.filter(i => i.category === category).map(integration => (
              <Card key={integration.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${integration.color}`}>
                        {integration.logo}
                      </div>
                      <div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <Badge variant="outline" className="text-xs mt-1">
                          Coming Soon
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-sm text-muted-foreground mb-4">
                    {integration.description}
                  </p>

                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Key Features</p>
                    <ul className="space-y-1">
                      {integration.features.map(feature => (
                        <li key={feature} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto">
                    {notifiedIds.has(integration.id) ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        <Bell className="h-4 w-4 mr-2" />
                        Notification Set
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleNotify(integration.id, integration.name)}
                      >
                        <Bell className="h-4 w-4 mr-2" />
                        Notify Me
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Separator className="mt-6" />
        </div>
      ))}

      {/* Request Integration */}
      <Card className="p-6 text-center">
        <h3 className="font-semibold mb-2">Don't see your tool?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          We're always looking to add new integrations. Let us know what tools you'd like to connect.
        </p>
        <Button variant="outline" onClick={() => toast.info('Feature request noted — thank you!')}>
          Request an Integration
        </Button>
      </Card>
      </div>
    </PageShell>
  )
}
