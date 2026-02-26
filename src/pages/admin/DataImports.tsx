import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Users, Shield, Trash2, AlertTriangle, History, Clock } from 'lucide-react'
import { PageShell, PageToolbar } from '@/components/shared'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { parseOrdersExcel, downloadTemplate, type ParseResult } from '@/lib/utils/excelParser'
import { parseMenuItemsExcel, downloadMenuItemsTemplate, type ParseResult as MenuItemsParseResult } from '@/lib/utils/menuItemsParser'
import { parseStaffExcel, downloadStaffTemplate, type ParseResult as StaffParseResult } from '@/lib/utils/staffParser'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDataStore } from '@/lib/store/dataStore'
import { useLoadOrders } from '@/hooks/useLoadOrders'
import { Separator } from '@/components/ui/separator'
import { InvoicesTab } from './data-imports/InvoicesTab'

interface ImportHistoryEntry {
  id: string
  date: Date
  type: 'sales' | 'invoices' | 'menu_items' | 'staff'
  file_name: string
  records_imported: number
  records_skipped: number
  records_errored: number
  status: 'success' | 'partial' | 'failed'
}

export default function DataImports() {
  // Sales Data state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  
  // Menu Items state
  const [menuItemsFile, setMenuItemsFile] = useState<File | null>(null)
  const [menuItemsResult, setMenuItemsResult] = useState<MenuItemsParseResult | null>(null)
  const [isProcessingMenuItems, setIsProcessingMenuItems] = useState(false)
  const [isImportingMenuItems, setIsImportingMenuItems] = useState(false)
  
  // Staff state
  const [staffFile, setStaffFile] = useState<File | null>(null)
  const [staffResult, setStaffResult] = useState<StaffParseResult | null>(null)
  const [isProcessingStaff, setIsProcessingStaff] = useState(false)
  const [isImportingStaff, setIsImportingStaff] = useState(false)
  
  // Import history
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([])

  const addHistoryEntry = (entry: Omit<ImportHistoryEntry, 'id' | 'date'>) => {
    setImportHistory(prev => [{
      ...entry,
      id: crypto.randomUUID(),
      date: new Date(),
    }, ...prev])
  }
const {
    orders,
    ingredients,
    suppliers,
    staff,
    purchaseOrders,
    exportBackup,
    importBackup,
    clearAllData,
    hasImportedData,
    _lastImportDate
  } = useDataStore()
  
  // Load existing orders from database
  useLoadOrders()
  
  // Calculate total records
  const totalRecords = (orders?.length || 0) + (ingredients?.length || 0) + (suppliers?.length || 0) + (staff?.length || 0)
  
  const handleDownloadBackup = () => {
    const backup = exportBackup()
    const blob = new Blob([backup], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `supersolt-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success('Full backup downloaded')
  }
  
  const handleRestoreBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return
      
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        importBackup(content)
      }
      reader.readAsText(file)
    }
    
    input.click()
  }
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    setSelectedFile(file)
    setIsProcessing(true)
    
    try {
      const result = await parseOrdersExcel(file)
      setParseResult(result)
      
      if (result.summary.valid_rows > 0) {
        toast.success(result.errors.length > 0 ? 'File parsed with errors' : 'File parsed successfully', { description: `${result.summary.valid_rows} valid orders found${result.errors.length > 0 ? `, ${result.errors.length} rows have errors` : ''}`, })
      } else {
        toast.error('No valid data found', { description: `${result.errors.length} errors found. Please fix your file.` })
      }
    } catch (error) {
      toast.error('Failed to parse file', { description: error instanceof Error ? error.message : 'Unknown error' })
      setParseResult(null)
    } finally {
      setIsProcessing(false)
    }
  }
  
  
  const handleImport = async () => {
    if (!parseResult || parseResult.data.length === 0) return
    
    setIsImporting(true)
    
    try {
      // CRITICAL: Import saves to database AND replaces store data
      const { importParsedOrders } = useDataStore.getState()
      await importParsedOrders(parseResult.data)
      
      // Verify final count
      const storeOrderCount = useDataStore.getState().orders.length

      addHistoryEntry({
        type: 'sales',
        file_name: selectedFile?.name || 'unknown',
        records_imported: storeOrderCount,
        records_skipped: parseResult.summary.invalid_rows,
        records_errored: parseResult.errors.length,
        status: parseResult.errors.length > 0 ? 'partial' : 'success',
      })

      toast.success('Import successful!', { description: `Imported ${storeOrderCount} orders. Go to Insights to see your data.`, })

      setSelectedFile(null)
      setParseResult(null)

    } catch (error) {
      console.error('Import error:', error)
      addHistoryEntry({
        type: 'sales',
        file_name: selectedFile?.name || 'unknown',
        records_imported: 0,
        records_skipped: 0,
        records_errored: parseResult?.summary.total_rows || 0,
        status: 'failed',
      })
      toast.error('Import failed', { description: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setIsImporting(false)
    }
  }
  
  // Menu Items handlers
  const handleMenuItemsFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    setMenuItemsFile(file)
    setIsProcessingMenuItems(true)
    
    try {
      const result = await parseMenuItemsExcel(file)
      setMenuItemsResult(result)
      
      if (result.summary.valid_rows > 0) {
        toast.success(result.errors.length > 0 ? 'File parsed with errors' : 'File parsed successfully', { description: `${result.summary.valid_rows} valid menu items found${result.errors.length > 0 ? `, ${result.errors.length} rows have errors` : ''}`, })
      } else {
        toast.error('No valid data found', { description: `${result.errors.length} errors found. Please fix your file.` })
      }
    } catch (error) {
      toast.error('Failed to parse file', { description: error instanceof Error ? error.message : 'Unknown error' })
      setMenuItemsResult(null)
    } finally {
      setIsProcessingMenuItems(false)
    }
  }
  
  const handleMenuItemsImport = async () => {
    if (!menuItemsResult || menuItemsResult.data.length === 0) return
    
    setIsImportingMenuItems(true)
    
    try {
      addHistoryEntry({
        type: 'menu_items',
        file_name: menuItemsFile?.name || 'unknown',
        records_imported: menuItemsResult.summary.valid_rows,
        records_skipped: menuItemsResult.summary.invalid_rows,
        records_errored: menuItemsResult.errors.length,
        status: menuItemsResult.errors.length > 0 ? 'partial' : 'success',
      })

      toast.success('Import successful!', { description: `Imported ${menuItemsResult.summary.valid_rows} menu items.`, })

      setMenuItemsFile(null)
      setMenuItemsResult(null)

    } catch (error) {
      console.error('Import error:', error)
      toast.error('Import failed', { description: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setIsImportingMenuItems(false)
    }
  }
  
  // Staff handlers
  const handleStaffFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    setStaffFile(file)
    setIsProcessingStaff(true)
    
    try {
      const result = await parseStaffExcel(file)
      setStaffResult(result)
      
      if (result.summary.valid_rows > 0) {
        toast.success(result.errors.length > 0 ? 'File parsed with errors' : 'File parsed successfully', { description: `${result.summary.valid_rows} valid staff members found${result.errors.length > 0 ? `, ${result.errors.length} rows have errors` : ''}`, })
      } else {
        toast.error('No valid data found', { description: `${result.errors.length} errors found. Please fix your file.` })
      }
    } catch (error) {
      toast.error('Failed to parse file', { description: error instanceof Error ? error.message : 'Unknown error' })
      setStaffResult(null)
    } finally {
      setIsProcessingStaff(false)
    }
  }
  
  const handleStaffImport = async () => {
    if (!staffResult || staffResult.data.length === 0) return
    
    setIsImportingStaff(true)
    
    try {
      addHistoryEntry({
        type: 'staff',
        file_name: staffFile?.name || 'unknown',
        records_imported: staffResult.summary.valid_rows,
        records_skipped: staffResult.summary.invalid_rows,
        records_errored: staffResult.errors.length,
        status: staffResult.errors.length > 0 ? 'partial' : 'success',
      })

      toast.success('Import successful!', { description: `Imported ${staffResult.summary.valid_rows} staff members.`, })

      setStaffFile(null)
      setStaffResult(null)

    } catch (error) {
      console.error('Import error:', error)
      toast.error('Import failed', { description: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setIsImportingStaff(false)
    }
  }
  
  const toolbar = (
    <PageToolbar title="Data Imports" />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-6 space-y-6">
      
      {/* Data Status & Backup Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Current Data</h3>
            <p className="text-sm text-muted-foreground">
              All data is automatically saved to localStorage
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasImportedData && (
              <Badge className="bg-green-600 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Data Protected
              </Badge>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Total Records</p>
            <p className="text-3xl font-bold">{totalRecords.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sales Orders</p>
            <p className="text-2xl font-bold">{orders?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Ingredients</p>
            <p className="text-2xl font-bold">{ingredients?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Suppliers</p>
            <p className="text-2xl font-bold">{suppliers?.length || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Staff</p>
            <p className="text-2xl font-bold">{staff?.length || 0}</p>
          </div>
        </div>
        
        {_lastImportDate && (
          <p className="text-xs text-muted-foreground mb-4">
            Last import: {new Date(_lastImportDate).toLocaleString('en-AU')}
          </p>
        )}
        
        <div className="flex gap-2">
          <Button onClick={handleDownloadBackup}>
            <Download className="h-4 w-4 mr-2" />
            Download Full Backup
          </Button>
          <Button variant="outline" onClick={handleRestoreBackup}>
            <Upload className="h-4 w-4 mr-2" />
            Restore from Backup
          </Button>
        </div>
      </Card>
      
      {/* Danger Zone */}
      {totalRecords > 0 && (
        <Card className="p-6 border-red-200 bg-red-50/30">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
              <p className="text-sm text-red-700">
                Irreversible actions that permanently delete data
              </p>
            </div>
          </div>
          
          <Button variant="destructive" onClick={clearAllData}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Data
          </Button>
        </Card>
      )}
      
      {/* Import History */}
      {importHistory.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Import History</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Imported</TableHead>
                <TableHead className="text-right">Skipped</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importHistory.slice(0, 20).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {format(entry.date, 'dd/MM/yyyy HH:mm')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {entry.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono max-w-48 truncate">{entry.file_name}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-green-600">
                    {entry.records_imported}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {entry.records_skipped}
                  </TableCell>
                  <TableCell className="text-right text-sm text-red-600">
                    {entry.records_errored || 0}
                  </TableCell>
                  <TableCell>
                    {entry.status === 'success' && (
                      <Badge className="bg-green-600">Success</Badge>
                    )}
                    {entry.status === 'partial' && (
                      <Badge className="bg-yellow-600">Partial</Badge>
                    )}
                    {entry.status === 'failed' && (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {importHistory.length > 20 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Showing 20 most recent imports
            </p>
          )}
        </Card>
      )}

      <Separator />

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales Data</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="menu">Menu Items</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sales" className="space-y-6">
          {/* Instructions */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <FileSpreadsheet className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">How to Import Sales Data</h3>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li>1. Download the Excel template below</li>
                  <li>2. Fill in your sales data (sheet must be named "ORDERS")</li>
                  <li>3. Use date format: DD/MM/YYYY HH:MM</li>
                  <li>4. Upload the completed file</li>
                  <li>5. Review the preview and click Import</li>
                </ol>
                
                <div className="mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      downloadTemplate()
                      toast.success('Template downloaded')
                    }}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          
          {/* Upload Zone */}
          <Card className="p-6">
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              
              <div className="mb-4">
                <p className="text-lg font-semibold mb-2">
                  {selectedFile ? selectedFile.name : 'Upload Excel File'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedFile 
                    ? 'File loaded - review below' 
                    : 'Select your sales data file'
                  }
                </p>
              </div>
              
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={isProcessing}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isProcessing ? 'Processing...' : 'Select File'}
                </Button>
                
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {selectedFile && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null)
                      setParseResult(null)
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                Supported: .xlsx, .xls
              </p>
            </div>
          </Card>
          
          {/* Results */}
          {parseResult && (
            <>
              {/* Summary */}
              <Card className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold mb-4">Import Summary</h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-2xl font-bold">
                          {parseResult.summary.total_rows}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Rows</div>
                      </div>
                      
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {parseResult.summary.valid_rows}
                        </div>
                        <div className="text-sm text-muted-foreground">Valid</div>
                      </div>
                      
                      <div>
                        <div className="text-2xl font-bold text-red-600">
                          {parseResult.summary.invalid_rows}
                        </div>
                        <div className="text-sm text-muted-foreground">Errors</div>
                      </div>
                      
                      <div>
                        <div className="text-2xl font-bold">
                          ${parseResult.summary.total_sales.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Sales</div>
                      </div>
                    </div>
                    
                    {parseResult.summary.date_range.start && (
                      <div className="mt-4 text-sm text-muted-foreground">
                        Date range: {format(parseResult.summary.date_range.start, 'dd/MM/yyyy')}
                        {' to '}
                        {parseResult.summary.date_range.end && format(parseResult.summary.date_range.end, 'dd/MM/yyyy')}
                      </div>
                    )}
                  </div>
                  
                  {parseResult.success ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  )}
                </div>
              </Card>
              
              {/* Errors */}
              {parseResult.errors.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    Errors ({parseResult.errors.length})
                  </h3>
                  
                  <div className="space-y-2">
                    {parseResult.errors.slice(0, 10).map((error, idx) => (
                      <Alert key={idx} variant="destructive">
                        <AlertDescription>
                          <Badge variant="outline" className="mr-2">Row {error.row}</Badge>
                          <span className="font-mono text-xs mr-2">{error.column}</span>
                          {error.message}
                        </AlertDescription>
                      </Alert>
                    ))}
                    {parseResult.errors.length > 10 && (
                      <p className="text-sm text-muted-foreground">
                        ...and {parseResult.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </Card>
              )}
              
              {/* Warnings */}
              {parseResult.warnings.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    Warnings ({parseResult.warnings.length})
                  </h3>
                  
                  <div className="space-y-2">
                    {parseResult.warnings.slice(0, 5).map((warning, idx) => (
                      <Alert key={idx}>
                        <AlertDescription>
                          <Badge variant="outline" className="mr-2">Row {warning.row}</Badge>
                          <span className="font-mono text-xs mr-2">{warning.column}</span>
                          {warning.message}
                        </AlertDescription>
                      </Alert>
                    ))}
                    {parseResult.warnings.length > 5 && (
                      <p className="text-sm text-muted-foreground">
                        ...and {parseResult.warnings.length - 5} more warnings
                      </p>
                    )}
                  </div>
                </Card>
              )}
              
              {/* Preview */}
              {parseResult.data.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Preview (First 20 Orders)</h3>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Order #</TableHead>
                          <TableHead>Date/Time</TableHead>
                          <TableHead>Channel</TableHead>
                          <TableHead>Gross</TableHead>
                          <TableHead>Tax</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parseResult.data.slice(0, 20).map((order, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">
                              {order.order_number}
                            </TableCell>
                            <TableCell>
                              {format(order.order_datetime, 'dd/MM/yyyy HH:mm')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {order.channel}
                              </Badge>
                            </TableCell>
                            <TableCell>${order.gross_inc_tax.toFixed(2)}</TableCell>
                            <TableCell>${order.tax_amount.toFixed(2)}</TableCell>
                            <TableCell>
                              {order.is_void && <Badge variant="destructive">Void</Badge>}
                              {order.is_refund && <Badge variant="secondary">Refund</Badge>}
                              {!order.is_void && !order.is_refund && <Badge variant="default">Valid</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {parseResult.data.length > 20 && (
                    <p className="text-sm text-muted-foreground mt-4">
                      ...and {parseResult.data.length - 20} more orders
                    </p>
                  )}
                </Card>
              )}
              
              {/* Import Button */}
              {parseResult.data.length > 0 && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null)
                      setParseResult(null)
                    }}
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {isImporting ? 'Importing...' : `Import ${parseResult.summary.valid_rows} Valid Order${parseResult.summary.valid_rows !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              )}
            </>
          )}
          
          {!selectedFile && !parseResult && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                No file selected. Download the template above to get started, or upload an existing Excel file with an "ORDERS" sheet.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          <InvoicesTab />
        </TabsContent>
        
        {/* Menu Items Tab */}
        <TabsContent value="menu" className="space-y-6">
          {/* Instructions */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <FileSpreadsheet className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">How to Import Menu Items</h3>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li>1. Download the Excel template below</li>
                  <li>2. Fill in your menu items (sheet must be named "MENU_ITEMS")</li>
                  <li>3. Required columns: Item Name, Category, Price, GST, Available</li>
                  <li>4. Upload the completed file</li>
                  <li>5. Review the preview and click Import</li>
                </ol>
                
                <div className="mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      downloadMenuItemsTemplate()
                      toast.success('Template downloaded')
                    }}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          
          {/* Upload Zone */}
          <Card className="p-6">
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              
              <div className="mb-4">
                <p className="text-lg font-semibold mb-2">
                  {menuItemsFile ? menuItemsFile.name : 'Upload Excel File'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {menuItemsFile 
                    ? 'File loaded - review below' 
                    : 'Select your menu items file'
                  }
                </p>
              </div>
              
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => document.getElementById('menu-items-upload')?.click()}
                  disabled={isProcessingMenuItems}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isProcessingMenuItems ? 'Processing...' : 'Select File'}
                </Button>
                
                <input
                  id="menu-items-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleMenuItemsFileSelect}
                  className="hidden"
                />
                
                {menuItemsFile && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMenuItemsFile(null)
                      setMenuItemsResult(null)
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                Supported: .xlsx, .xls
              </p>
            </div>
          </Card>
          
          {/* Results */}
          {menuItemsResult && (
            <>
              {/* Summary */}
              <Card className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold mb-4">Import Summary</h3>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-2xl font-bold">
                          {menuItemsResult.summary.total_rows}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Rows</div>
                      </div>
                      
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {menuItemsResult.summary.valid_rows}
                        </div>
                        <div className="text-sm text-muted-foreground">Valid</div>
                      </div>
                      
                      <div>
                        <div className="text-2xl font-bold text-red-600">
                          {menuItemsResult.summary.invalid_rows}
                        </div>
                        <div className="text-sm text-muted-foreground">Errors</div>
                      </div>
                    </div>
                  </div>
                  
                  {menuItemsResult.success ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  )}
                </div>
              </Card>
              
              {/* Errors */}
              {menuItemsResult.errors.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    Errors ({menuItemsResult.errors.length})
                  </h3>
                  
                  <div className="space-y-2">
                    {menuItemsResult.errors.slice(0, 10).map((error, idx) => (
                      <Alert key={idx} variant="destructive">
                        <AlertDescription>
                          <Badge variant="outline" className="mr-2">Row {error.row}</Badge>
                          <span className="font-mono text-xs mr-2">{error.field}</span>
                          {error.message}
                        </AlertDescription>
                      </Alert>
                    ))}
                    {menuItemsResult.errors.length > 10 && (
                      <p className="text-sm text-muted-foreground">
                        ...and {menuItemsResult.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </Card>
              )}
              
              {/* Preview */}
              {menuItemsResult.data.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Preview (First 100 Items)</h3>
                  
                  <div className="overflow-x-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>GST</TableHead>
                          <TableHead>Available</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {menuItemsResult.data.slice(0, 100).map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {item.category}
                              </Badge>
                            </TableCell>
                            <TableCell>${(item.price / 100).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={item.gst ? "default" : "secondary"}>
                                {item.gst ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={item.available ? "default" : "secondary"}>
                                {item.available ? 'Yes' : 'No'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {menuItemsResult.data.length > 100 && (
                    <p className="text-sm text-muted-foreground mt-4">
                      ...and {menuItemsResult.data.length - 100} more items
                    </p>
                  )}
                </Card>
              )}
              
              {/* Import Button */}
              {menuItemsResult.data.length > 0 && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMenuItemsFile(null)
                      setMenuItemsResult(null)
                    }}
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    onClick={handleMenuItemsImport}
                    disabled={isImportingMenuItems || menuItemsResult.errors.length > 0}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {isImportingMenuItems ? 'Importing...' : `Import ${menuItemsResult.summary.valid_rows} Item${menuItemsResult.summary.valid_rows !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              )}
            </>
          )}
          
          {!menuItemsFile && !menuItemsResult && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                No file selected. Download the template above to get started, or upload an existing Excel file with a "MENU_ITEMS" sheet.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
        
        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-6">
          {/* Instructions */}
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <Users className="w-8 h-8 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">How to Import Staff</h3>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li>1. Download the Excel template below</li>
                  <li>2. Fill in your staff details (sheet must be named "STAFF")</li>
                  <li>3. Required columns: First Name, Last Name, Email, Phone, Role, Hourly Rate, Start Date</li>
                  <li>4. Use date format: DD/MM/YYYY</li>
                  <li>5. Upload the completed file</li>
                  <li>6. Review the preview and click Import</li>
                </ol>
                
                <div className="mt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      downloadStaffTemplate()
                      toast.success('Template downloaded')
                    }}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          
          {/* Upload Zone */}
          <Card className="p-6">
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              
              <div className="mb-4">
                <p className="text-lg font-semibold mb-2">
                  {staffFile ? staffFile.name : 'Upload Excel File'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {staffFile 
                    ? 'File loaded - review below' 
                    : 'Select your staff data file'
                  }
                </p>
              </div>
              
              <div className="flex justify-center gap-2">
                <Button
                  onClick={() => document.getElementById('staff-upload')?.click()}
                  disabled={isProcessingStaff}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isProcessingStaff ? 'Processing...' : 'Select File'}
                </Button>
                
                <input
                  id="staff-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleStaffFileSelect}
                  className="hidden"
                />
                
                {staffFile && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStaffFile(null)
                      setStaffResult(null)
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground mt-4">
                Supported: .xlsx, .xls
              </p>
            </div>
          </Card>
          
          {/* Results */}
          {staffResult && (
            <>
              {/* Summary */}
              <Card className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold mb-4">Import Summary</h3>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-2xl font-bold">
                          {staffResult.summary.total_rows}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Rows</div>
                      </div>
                      
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {staffResult.summary.valid_rows}
                        </div>
                        <div className="text-sm text-muted-foreground">Valid</div>
                      </div>
                      
                      <div>
                        <div className="text-2xl font-bold text-red-600">
                          {staffResult.summary.invalid_rows}
                        </div>
                        <div className="text-sm text-muted-foreground">Errors</div>
                      </div>
                    </div>
                  </div>
                  
                  {staffResult.success ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  )}
                </div>
              </Card>
              
              {/* Errors */}
              {staffResult.errors.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    Errors ({staffResult.errors.length})
                  </h3>
                  
                  <div className="space-y-2">
                    {staffResult.errors.slice(0, 10).map((error, idx) => (
                      <Alert key={idx} variant="destructive">
                        <AlertDescription>
                          <Badge variant="outline" className="mr-2">Row {error.row}</Badge>
                          <span className="font-mono text-xs mr-2">{error.field}</span>
                          {error.message}
                        </AlertDescription>
                      </Alert>
                    ))}
                    {staffResult.errors.length > 10 && (
                      <p className="text-sm text-muted-foreground">
                        ...and {staffResult.errors.length - 10} more errors
                      </p>
                    )}
                  </div>
                </Card>
              )}
              
              {/* Preview */}
              {staffResult.data.length > 0 && (
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Preview (First 100 Staff)</h3>
                  
                  <div className="overflow-x-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Hourly Rate</TableHead>
                          <TableHead>Start Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {staffResult.data.slice(0, 100).map((staff, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">
                              {staff.firstName} {staff.lastName}
                            </TableCell>
                            <TableCell className="text-sm">{staff.email}</TableCell>
                            <TableCell className="text-sm">
                              {staff.phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {staff.role}
                              </Badge>
                            </TableCell>
                            <TableCell>${(staff.hourlyRate / 100).toFixed(2)}</TableCell>
                            <TableCell>
                              {format(new Date(staff.startDate), 'dd/MM/yyyy')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {staffResult.data.length > 100 && (
                    <p className="text-sm text-muted-foreground mt-4">
                      ...and {staffResult.data.length - 100} more staff members
                    </p>
                  )}
                </Card>
              )}
              
              {/* Import Button */}
              {staffResult.data.length > 0 && (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStaffFile(null)
                      setStaffResult(null)
                    }}
                  >
                    Cancel
                  </Button>
                  
                  <Button
                    onClick={handleStaffImport}
                    disabled={isImportingStaff || staffResult.errors.length > 0}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    {isImportingStaff ? 'Importing...' : `Import ${staffResult.summary.valid_rows} Staff Member${staffResult.summary.valid_rows !== 1 ? 's' : ''}`}
                  </Button>
                </div>
              )}
            </>
          )}
          
          {!staffFile && !staffResult && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                No file selected. Download the template above to get started, or upload an existing Excel file with a "STAFF" sheet.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </PageShell>
  )
}
