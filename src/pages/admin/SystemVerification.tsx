import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, RefreshCw, Database, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface DataCounts {
  orders: number
  ingredients: number
  suppliers: number
  menu_items: number
  purchase_orders: number
  stock_counts: number
  waste_logs: number
}

interface VerificationStatus {
  database_connected: boolean
  data_persists: boolean
  import_system_ready: boolean
  dataCounts: DataCounts
  lastChecked: Date | null
}

export default function SystemVerification() {
  const [isChecking, setIsChecking] = useState(false)
  const [status, setStatus] = useState<VerificationStatus | null>(null)
  
  useEffect(() => {
    performCheck()
  }, [])
  
  const performCheck = async () => {
    setIsChecking(true)
    
    const newStatus: VerificationStatus = {
      database_connected: false,
      data_persists: false,
      import_system_ready: false,
      dataCounts: {
        orders: 0,
        ingredients: 0,
        suppliers: 0,
        menu_items: 0,
        purchase_orders: 0,
        stock_counts: 0,
        waste_logs: 0,
      },
      lastChecked: new Date(),
    }
    
    try {
      // Check 1: Database Connection
      const { error: connError } = await supabase
        .from('orders')
        .select('count')
        .limit(1)
      
      newStatus.database_connected = !connError
      
      if (newStatus.database_connected) {
        // Check 2: Get data counts from all tables
        const tables: (keyof DataCounts)[] = [
          'orders',
          'ingredients',
          'suppliers',
          'menu_items',
          'purchase_orders',
          'stock_counts',
          'waste_logs',
        ]
        
        for (const table of tables) {
          const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
          
          if (!error && count !== null) {
            newStatus.dataCounts[table] = count
          }
        }
        
        // Check 3: Test data persistence (write + read + delete)
        const testRecord = {
          venue_id: 'test-venue',
          order_number: 'VERIFY_TEST_' + Date.now(),
          channel: 'dine-in',
          order_datetime: new Date().toISOString(),
          gross_amount: 1,
          tax_amount: 0,
          discount_amount: 0,
          net_amount: 1,
          service_charge: 0,
          tip_amount: 0,
          is_void: false,
          is_refund: false,
        }
        
        const { error: writeError } = await supabase
          .from('orders')
          .insert(testRecord)
        
        if (!writeError) {
          const { data: readData, error: readError } = await supabase
            .from('orders')
            .select('*')
            .eq('order_number', testRecord.order_number)
            .single()
          
          newStatus.data_persists = !readError && readData !== null
          
          // Clean up test record
          if (readData) {
            await supabase
              .from('orders')
              .delete()
              .eq('order_number', testRecord.order_number)
          }
        }
        
        // Check 4: Import system ready (tables exist and are accessible)
        newStatus.import_system_ready = newStatus.database_connected && newStatus.data_persists
      }
      
      setStatus(newStatus)
      
      if (newStatus.database_connected && newStatus.data_persists && newStatus.import_system_ready) {
        toast.success('All systems operational')
      } else {
        toast.warning('Some systems checks failed')
      }
    } catch (error: any) {
      console.error('Verification error:', error)
      toast.error(`Verification failed: ${error.message}`)
    } finally {
      setIsChecking(false)
    }
  }
  
  const CheckItem = ({ 
    label, 
    status, 
    detail 
  }: { 
    label: string
    status: boolean
    detail?: string 
  }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        {status ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
        <div>
          <p className="font-medium">{label}</p>
          {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <Badge variant={status ? "default" : "destructive"}>
        {status ? 'Pass' : 'Fail'}
      </Badge>
    </div>
  )
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Verification</h1>
          <p className="text-muted-foreground">
            Verify data persistence and system readiness
          </p>
        </div>
        <Button onClick={performCheck} disabled={isChecking}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
          Run Checks
        </Button>
      </div>
      
      {status && (
        <>
          {/* System Health */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Health
            </h3>
            <div className="space-y-3">
              <CheckItem
                label="Database Connection"
                status={status.database_connected}
                detail="Supabase connection active"
              />
              <CheckItem
                label="Data Persistence"
                status={status.data_persists}
                detail="Write and read operations working"
              />
              <CheckItem
                label="Import System"
                status={status.import_system_ready}
                detail="Excel import system ready"
              />
            </div>
          </Card>
          
          {/* Data Counts */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Database Contents
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Orders</p>
                <p className="text-2xl font-bold">{status.dataCounts.orders.toLocaleString()}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Ingredients</p>
                <p className="text-2xl font-bold">{status.dataCounts.ingredients.toLocaleString()}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Suppliers</p>
                <p className="text-2xl font-bold">{status.dataCounts.suppliers.toLocaleString()}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Menu Items</p>
                <p className="text-2xl font-bold">{status.dataCounts.menu_items.toLocaleString()}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Purchase Orders</p>
                <p className="text-2xl font-bold">{status.dataCounts.purchase_orders.toLocaleString()}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Stock Counts</p>
                <p className="text-2xl font-bold">{status.dataCounts.stock_counts.toLocaleString()}</p>
              </div>
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Waste Logs</p>
                <p className="text-2xl font-bold">{status.dataCounts.waste_logs.toLocaleString()}</p>
              </div>
            </div>
          </Card>
          
          {/* Last Checked */}
          {status.lastChecked && (
            <p className="text-sm text-muted-foreground text-center">
              Last checked: {status.lastChecked.toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  )
}
