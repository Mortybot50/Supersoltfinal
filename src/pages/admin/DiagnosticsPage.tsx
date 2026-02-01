import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Play, Download, Search, CheckCircle2, XCircle, AlertTriangle, Info, RefreshCw, Building2, ChevronRight } from 'lucide-react'
import { useDiagnosticsStore } from '@/stores/useDiagnosticsStore'
import { DiagnosticsResult, DiagnosticsSeverity, DiagnosticsCategory } from '@/types'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

const SEVERITY_CONFIG: Record<DiagnosticsSeverity, { icon: any; color: string; bg: string }> = {
  fail: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  warn: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  pass: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200' }
}

const CATEGORY_LABELS: Record<DiagnosticsCategory, string> = {
  settings: 'Settings & Persistence',
  suppliers: 'Suppliers',
  catalog: 'Supplier Catalog',
  ingredients: 'Ingredients & Costs',
  recipes: 'Recipes',
  menu: 'Menu Items',
  locations: 'Locations',
  rbac: 'Access & Roles',
  intake: 'Invoice Intake'
}

export default function DiagnosticsPage() {
  const navigate = useNavigate()
  const { jobs, selectedJob, isRunning, severityFilter, searchQuery, runDiagnostics, getJobResults, selectJob, setFilters, exportCSV, getLatestJob } = useDiagnosticsStore()
  const [venueId, setVenueId] = useState<string>('all')
  
  useEffect(() => {
    const latest = getLatestJob()
    if (latest && !selectedJob) selectJob(latest)
  }, [jobs])
  
  const handleRun = async () => {
    try {
      await runDiagnostics('DEMO-ORG', venueId === 'all' ? undefined : venueId)
      toast.success('Diagnostics complete!')
    } catch { toast.error('Diagnostics failed') }
  }
  
  const results = selectedJob ? getJobResults(selectedJob.id) : []
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Diagnostics</h1>
          <p className="text-muted-foreground mt-1">Verify pilot health across all SuperSolt systems</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={venueId} onValueChange={setVenueId}>
            <SelectTrigger className="w-[200px]">
              <Building2 className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              <SelectItem value="main">Main Venue</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRun} disabled={isRunning}>
            {isRunning ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Running...</> : <><Play className="h-4 w-4 mr-2" />Run All Checks</>}
          </Button>
        </div>
      </div>
      
      {/* KPI Cards */}
      {selectedJob && (
        <div className="grid grid-cols-4 gap-4">
          {(['fail', 'warn', 'info', 'pass'] as const).map(sev => {
            const config = SEVERITY_CONFIG[sev]
            const Icon = config.icon
            const count = selectedJob.summary_json[sev]
            return (
              <Card key={sev} className={`p-4 cursor-pointer hover:shadow-md ${severityFilter === sev ? 'ring-2 ring-primary' : ''} ${config.bg} border`} onClick={() => setFilters({ severity: sev })}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground capitalize">{sev === 'fail' ? 'Failures' : sev === 'warn' ? 'Warnings' : sev}</p>
                    <p className={`text-3xl font-bold ${config.color}`}>{count}</p>
                  </div>
                  <Icon className={`h-8 w-8 ${config.color} opacity-50`} />
                </div>
              </Card>
            )
          })}
        </div>
      )}
      
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search checks..." value={searchQuery} onChange={e => setFilters({ search: e.target.value })} className="pl-9" />
        </div>
        <Tabs value={severityFilter} onValueChange={v => setFilters({ severity: v as any })}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="fail" className="text-red-600">Fail</TabsTrigger>
            <TabsTrigger value="warn" className="text-yellow-600">Warn</TabsTrigger>
            <TabsTrigger value="pass" className="text-green-600">Pass</TabsTrigger>
          </TabsList>
        </Tabs>
        {selectedJob && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => exportCSV(selectedJob.id)}>
            <Download className="h-4 w-4 mr-2" />CSV
          </Button>
        )}
      </div>
      
      {/* Results Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[180px]">Category</TableHead>
              <TableHead>Check</TableHead>
              <TableHead>Detail</TableHead>
              <TableHead className="text-right w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isRunning ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-64" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                </TableRow>
              ))
            ) : results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground opacity-50" />
                    <p className="font-medium">{selectedJob ? 'No results match filters' : 'No diagnostics run yet'}</p>
                    {!selectedJob && <Button onClick={handleRun}><Play className="h-4 w-4 mr-2" />Run Diagnostics</Button>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              results.map(result => {
                const config = SEVERITY_CONFIG[result.severity]
                const Icon = config.icon
                return (
                  <TableRow key={result.id} className={result.severity === 'fail' ? 'bg-red-50/50' : ''}>
                    <TableCell>
                      <Badge variant="outline" className={`${config.bg} border`}>
                        <Icon className={`h-3 w-3 mr-1 ${config.color}`} />
                        {result.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell><span className="text-sm text-muted-foreground">{CATEGORY_LABELS[result.category]}</span></TableCell>
                    <TableCell>
                      <p className="font-medium">{result.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{result.check_id}</p>
                    </TableCell>
                    <TableCell><p className="text-sm">{result.detail}</p></TableCell>
                    <TableCell className="text-right">
                      {result.quick_fix_available && result.quick_fix_url && (
                        <Button variant="ghost" size="sm" onClick={() => navigate(result.quick_fix_url!)}>
                          Fix<ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
      
      {/* Job History */}
      {jobs.length > 1 && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">Recent Runs</h3>
          <div className="flex flex-wrap gap-2">
            {jobs.slice(0, 5).map(job => (
              <Button key={job.id} variant={selectedJob?.id === job.id ? 'default' : 'outline'} size="sm" onClick={() => selectJob(job)}>
                {format(new Date(job.started_at), 'dd MMM HH:mm')}
                <Badge variant="secondary" className={`ml-2 ${job.summary_json.fail > 0 ? 'bg-red-100 text-red-800' : job.summary_json.warn > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                  {job.summary_json.fail > 0 ? `${job.summary_json.fail} fail` : 'clean'}
                </Badge>
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
