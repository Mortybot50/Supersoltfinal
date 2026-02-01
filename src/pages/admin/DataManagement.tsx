import { useState, useEffect } from 'react'
import { Download, Trash2, CheckCircle, AlertTriangle, Database, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useDataStore } from '@/lib/store/dataStore'

interface PersistenceCheck {
  database_connected: boolean
  tables_exist: boolean
  data_count: number
  data_persists: boolean
}

interface WipeResult {
  success?: boolean
  report?: {
    beforeCounts: Record<string, number | string>
    afterCounts: Record<string, number | string>
    errors: string[]
  }
}

export default function DataManagement() {
  const [isExporting, setIsExporting] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [persistenceResult, setPersistenceResult] = useState<PersistenceCheck | null>(null)
  const [dataCount, setDataCount] = useState(0)
  const [ordersConfirmText, setOrdersConfirmText] = useState('')
  const [isDeletingOrders, setIsDeletingOrders] = useState(false)
  const [ordersCount, setOrdersCount] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin'
        })
        setIsAdmin(data === true)
      }
    }
    checkAdmin()
  }, [])

  // Get current orders count
  useEffect(() => {
    const getOrdersCount = async () => {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
      setOrdersCount(count)
    }
    getOrdersCount()
  }, [])
  
  const ORDERS_DELETE_PHRASE = 'DELETE ALL DATA'
  
  // Load data count on mount
  useEffect(() => {
    loadDataCount()
  }, [])
  
  const loadDataCount = async () => {
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
      
      if (error) throw error
      setDataCount(count || 0)
    } catch (error) {
      console.error('Error loading data count:', error)
    }
  }
  
  const handleExport = async () => {
    setIsExporting(true)
    try {
      // Fetch all orders
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('order_datetime', { ascending: true })
      
      if (error) throw error
      
      if (!data || data.length === 0) {
        toast.error('No data to export')
        return
      }
      
      // Convert to CSV
      const headers = Object.keys(data[0])
      const csv = [
        headers.join(','),
        ...data.map((row) =>
          headers.map((h) => {
            const value = row[h as keyof typeof row]
            // Escape commas and quotes in values
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`
            }
            return value || ''
          }).join(',')
        ),
      ].join('\n')
      
      // Create audit log
      await supabase.from('admin_data_audit').insert({
        actor_user_id: 'admin',
        action: 'EXPORT_ALL',
        before_counts_json: { orders: data.length },
        after_counts_json: { orders: data.length },
        notes: `Exported ${data.length} orders`,
      })
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sales_export_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      
      toast.success(`Exported ${data.length} orders`)
    } catch (error: any) {
      console.error('Export error:', error)
      toast.error(`Export failed: ${error.message}`)
    } finally {
      setIsExporting(false)
    }
  }
  
  const handlePersistenceCheck = async () => {
    setIsChecking(true)
    const checks: PersistenceCheck = {
      database_connected: false,
      tables_exist: false,
      data_count: 0,
      data_persists: false,
    }
    
    try {
      // Check database connection
      const { error: connError } = await supabase
        .from('orders')
        .select('count')
        .limit(1)
      
      checks.database_connected = !connError
      
      // Check tables exist
      if (!connError) {
        checks.tables_exist = true
        
        // Get data count
        const { count, error: countError } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
        
        if (!countError) {
          checks.data_count = count || 0
        }
        
        // Test persistence (write + read)
        const testOrder = {
          venue_id: 'test-venue',
          order_number: 'PERSIST_TEST_' + Date.now(),
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
          .insert(testOrder)
        
        if (!writeError) {
          const { data: readData, error: readError } = await supabase
            .from('orders')
            .select('*')
            .eq('order_number', testOrder.order_number)
            .single()
          
          checks.data_persists = !readError && readData !== null
          
          // Clean up test order
          if (readData) {
            await supabase
              .from('orders')
              .delete()
              .eq('order_number', testOrder.order_number)
          }
        }
      }
      
      setPersistenceResult(checks)
      
      const allPassed = checks.database_connected && checks.tables_exist && checks.data_persists
      if (allPassed) {
        toast.success('All persistence checks passed! Data is stored in Supabase.')
      } else {
        toast.warning('Some persistence checks failed')
      }
    } catch (error: any) {
      console.error('Persistence check error:', error)
      toast.error(`Check failed: ${error.message}`)
    } finally {
      setIsChecking(false)
    }
  }
  
  const handleDeleteAllOrders = async () => {
    if (ordersConfirmText !== ORDERS_DELETE_PHRASE) {
      toast.error('Confirmation phrase does not match')
      return
    }

    if (!confirm(
      `⚠️ FINAL WARNING ⚠️\n\n` +
      `This will DELETE ${ordersCount?.toLocaleString() || 'all'} rows from the orders table.\n\n` +
      `This is PERMANENT and CANNOT be undone.\n\n` +
      `Continue?`
    )) {
      return
    }

    setIsDeletingOrders(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        toast.error('You must be logged in')
        return
      }

      const { data, error } = await supabase.functions.invoke('delete-all-orders', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (error) {
        console.error('Function error:', error)
        toast.error(`Failed to delete orders: ${error.message}`)
        return
      }

      if (data.error) {
        toast.error(data.error)
        return
      }

      toast.success(data.message || 'Successfully deleted all orders')
      setOrdersConfirmText('')
      setOrdersCount(0)
      setDataCount(0)

      // Refresh page after 2 seconds
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      console.error('Delete error:', error)
      toast.error(`Failed to delete orders: ${error.message}`)
    } finally {
      setIsDeletingOrders(false)
    }
  }
  
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Data Management</h1>
        <p className="text-muted-foreground">
          Export, verify, and manage your database
        </p>
      </div>
      
      {/* Current Data Status */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold mb-1">Database Status</h3>
            <p className="text-sm text-muted-foreground">
              Orders in database: <strong>{dataCount.toLocaleString()}</strong>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadDataCount}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </Card>
      
      {/* Export All Data */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Download className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Export All Data</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Download a CSV backup of all orders in the database. This creates a complete snapshot of your data.
            </p>
            <Button onClick={handleExport} disabled={isExporting || dataCount === 0}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export to CSV'}
            </Button>
          </div>
        </div>
      </Card>
      
      {/* Persistence Check */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <Database className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Persistence Check</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Verify that data is properly stored in Supabase and survives page refreshes. This checks database connectivity and data integrity.
            </p>
            
            <Button onClick={handlePersistenceCheck} disabled={isChecking}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {isChecking ? 'Checking...' : 'Run Check'}
            </Button>
            
            {persistenceResult && (
              <div className="mt-4 space-y-2 border rounded-lg p-4">
                <h4 className="font-semibold mb-3">Check Results:</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Database Connected</span>
                    {persistenceResult.database_connected ? (
                      <Badge className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Pass
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Fail
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tables Exist</span>
                    {persistenceResult.tables_exist ? (
                      <Badge className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Pass
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Fail
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Data Count</span>
                    <Badge variant="outline">
                      {persistenceResult.data_count.toLocaleString()} orders
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Data Persists</span>
                    {persistenceResult.data_persists ? (
                      <Badge className="bg-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Pass
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Fail
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
      
      {/* Delete All Orders Section */}
      {isAdmin && (
        <Card className="p-6 border-orange-200 bg-orange-50/50">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Database className="h-6 w-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Delete All Orders</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This will delete <strong>all {ordersCount?.toLocaleString() || '?'} rows</strong> from the orders table. This operation is permanent and cannot be undone.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Type <code className="bg-orange-100 px-2 py-1 rounded text-orange-900">{ORDERS_DELETE_PHRASE}</code> to confirm:
                  </label>
                  <Input
                    value={ordersConfirmText}
                    onChange={(e) => setOrdersConfirmText(e.target.value)}
                    placeholder={ORDERS_DELETE_PHRASE}
                    className="max-w-md"
                    disabled={isDeletingOrders}
                  />
                </div>

                <Button
                  variant="destructive"
                  onClick={handleDeleteAllOrders}
                  disabled={ordersConfirmText !== ORDERS_DELETE_PHRASE || isDeletingOrders}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeletingOrders ? 'Deleting...' : 'Delete All Orders'}
                </Button>
              </div>

              {ordersCount === 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm text-green-900 font-medium">
                    ✅ Orders table is empty
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
