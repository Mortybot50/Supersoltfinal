import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { PageShell, PageToolbar } from '@/components/shared'
import {
  Store,
  RefreshCw,
  Unplug,
  Loader2,
  CheckCircle,
  AlertCircle,
  Users,
  Settings,
  FileText,
} from 'lucide-react'
// ── Types ────────────────────────────────────────────────────────────

interface PosConnection {
  id: string
  provider: string
  merchant_id: string | null
  merchant_name: string | null
  is_active: boolean
  last_sync_at: string | null
  last_sync_status: string | null
  created_at: string
}

interface LocationMapping {
  pos_location_id: string
  pos_location_name: string | null
  venue_id: string
  is_active: boolean
}

interface XeroConnection {
  id: string
  tenant_id: string | null
  tenant_name: string | null
  is_active: boolean
  last_sync_at: string | null
  last_sync_status: string | null
  created_at: string
}

// ── Coming-soon card config (Xero removed — it's live now) ───────────
// Hidden for MVP: MYOB integration removed — keep only Square POS and Xero
const COMING_SOON = [
  {
    id: 'deputy',
    name: 'Deputy / Tanda',
    description: 'Sync rosters and timesheets',
    icon: Users,
    color: 'bg-blue-600',
  },
]

// ── Main component ───────────────────────────────────────────────────

export default function Integrations() {
  const { currentOrg, currentVenue } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // Square state
  const [squareConn, setSquareConn] = useState<PosConnection | null>(null)
  const [squareLocations, setSquareLocations] = useState<LocationMapping[]>([])
  const [squareLoading, setSquareLoading] = useState(true)
  const [squareSyncing, setSquareSyncing] = useState(false)
  const [squareDisconnecting, setSquareDisconnecting] = useState(false)
  const [confirmSquareDisconnect, setConfirmSquareDisconnect] = useState(false)

  // Xero state
  const [xeroConn, setXeroConn] = useState<XeroConnection | null>(null)
  const [xeroLoading, setXeroLoading] = useState(true)
  const [xeroSyncing, setXeroSyncing] = useState(false)
  const [xeroDisconnecting, setXeroDisconnecting] = useState(false)
  const [confirmXeroDisconnect, setConfirmXeroDisconnect] = useState(false)

  // ── Load Square connection ────────────────────────────────────────
  const loadSquare = useCallback(async () => {
    if (!currentOrg) return
    setSquareLoading(true)
    try {
      const { data: conn } = await supabase
        .from('pos_connections')
        .select('id, provider, merchant_id, merchant_name, is_active, last_sync_at, last_sync_status, created_at')
        .eq('org_id', currentOrg.id)
        .eq('provider', 'square')
        .single()

      if (conn?.is_active) {
        setSquareConn(conn)
        const { data: locs } = await supabase
          .from('pos_location_mappings')
          .select('pos_location_id, pos_location_name, venue_id, is_active')
          .eq('pos_connection_id', conn.id)
        setSquareLocations(locs ?? [])
      } else {
        setSquareConn(null)
        setSquareLocations([])
      }
    } catch {
      setSquareConn(null)
    } finally {
      setSquareLoading(false)
    }
  }, [currentOrg])

  // ── Load Xero connection ──────────────────────────────────────────
  const loadXero = useCallback(async () => {
    if (!currentOrg) return
    setXeroLoading(true)
    try {
      const { data: conn } = await supabase
        .from('xero_connections' as 'pos_connections')
        .select('id, tenant_id, tenant_name, is_active, last_sync_at, last_sync_status, created_at')
        .eq('org_id', currentOrg.id)
        .eq('is_active', true)
        .single() as { data: XeroConnection | null }

      setXeroConn(conn?.is_active ? conn : null)
    } catch {
      setXeroConn(null)
    } finally {
      setXeroLoading(false)
    }
  }, [currentOrg])

  useEffect(() => {
    loadSquare()
    loadXero()
  }, [loadSquare, loadXero])

  // ── Handle URL params (post-OAuth redirects) ──────────────────────
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected === 'square') {
      toast.success('Square POS connected successfully!')
      setSearchParams({}, { replace: true })
      setTimeout(() => window.location.reload(), 500)
    } else if (connected === 'xero') {
      toast.success('Xero connected successfully!')
      setSearchParams({}, { replace: true })
      loadXero()
    } else if (error) {
      const messages: Record<string, string> = {
        token_exchange_failed: 'Failed to connect. Please try again.',
        db_error: 'Connection saved but there was a database error.',
        invalid_state: 'Security check failed — please try connecting again.',
        tenants_fetch_failed: 'Connected but could not retrieve Xero organisation.',
        no_tenants: 'No Xero organisation found on this account.',
        unknown: 'An unexpected error occurred during connection.',
      }
      toast.error(messages[error] ?? `Connection error: ${error}`)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams, loadXero])

  // ── Square handlers ───────────────────────────────────────────────

  const handleSquareConnect = async () => {
    if (!currentOrg || !currentVenue) {
      toast.error('Please select an organisation and venue first')
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      toast.error('Not logged in — please sign in and try again')
      return
    }
    window.location.href = `/api/square/auth?org_id=${currentOrg.id}&venue_id=${currentVenue.id}&token=${session.access_token}`
  }

  const handleSquareSync = async () => {
    if (!currentOrg || !currentVenue) return
    setSquareSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/square/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ org_id: currentOrg.id, venue_id: currentVenue.id }),
      })
      const data = await res.json() as { success?: boolean; synced?: number; error?: string }
      if (res.ok && data.success) {
        toast.success(`Synced ${data.synced} new orders`)
        loadSquare()
      } else {
        toast.error(data.error ?? 'Sync failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync request failed')
    } finally {
      setSquareSyncing(false)
    }
  }

  const handleSquareDisconnect = async () => {
    if (!currentOrg) return
    setSquareDisconnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/square/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ org_id: currentOrg.id }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (res.ok && data.success) {
        toast.success('Square POS disconnected')
        setSquareConn(null)
        setSquareLocations([])
      } else {
        toast.error(data.error ?? 'Disconnect failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Disconnect request failed')
    } finally {
      setSquareDisconnecting(false)
      setConfirmSquareDisconnect(false)
    }
  }

  // ── Xero handlers ─────────────────────────────────────────────────

  const handleXeroConnect = async () => {
    if (!currentOrg) {
      toast.error('Please select an organisation first')
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      toast.error('Not logged in — please sign in and try again')
      return
    }
    window.location.href = `/api/xero/auth?org_id=${currentOrg.id}&token=${session.access_token}`
  }

  const handleXeroSync = async () => {
    if (!currentOrg) return
    setXeroSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/xero/api?action=sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          org_id: currentOrg.id,
          venue_id: currentVenue?.id,
          sync_types: ['sales', 'purchases'],
        }),
      })
      const data = await res.json() as {
        success?: boolean
        status?: string
        results?: Record<string, number>
        error?: string
      }
      if (res.ok && data.success) {
        const total = Object.values(data.results ?? {}).reduce((s, n) => s + n, 0)
        toast.success(`Xero sync complete — ${total} records pushed`)
        loadXero()
      } else if (data.status === 'partial') {
        toast.warning('Xero sync partially completed — some records failed')
        loadXero()
      } else {
        toast.error(data.error ?? 'Xero sync failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xero sync request failed')
    } finally {
      setXeroSyncing(false)
    }
  }

  const handleXeroDisconnect = async () => {
    if (!currentOrg) return
    setXeroDisconnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/xero/api?action=disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ org_id: currentOrg.id }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (res.ok && data.success) {
        toast.success('Xero disconnected')
        setXeroConn(null)
      } else {
        toast.error(data.error ?? 'Disconnect failed')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Disconnect request failed')
    } finally {
      setXeroDisconnecting(false)
      setConfirmXeroDisconnect(false)
    }
  }

  // ── Status helpers ────────────────────────────────────────────────
  const squareConnected = squareConn?.is_active === true
  const squareError = squareConnected && squareConn?.last_sync_status?.startsWith('error')
  const activeLocation = squareLocations.find(l => l.is_active)

  const xeroConnected = xeroConn?.is_active === true
  const xeroError = xeroConnected && xeroConn?.last_sync_status?.startsWith('error')

  const toolbar = <PageToolbar title="Integrations" />

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 md:p-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Connect your POS, accounting, and other tools
        </p>

        {/* Integration cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Square POS Card ──────────────────────────────────────── */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center font-bold text-sm">
                    SQ
                  </div>
                  <div>
                    <CardTitle className="text-base">Square POS</CardTitle>
                    {squareConnected && !squareError && (
                      <Badge className="mt-1 bg-[#B8E636] text-black hover:bg-[#a5cf2e]">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                    {squareError && (
                      <Badge variant="destructive" className="mt-1">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Error
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {squareLoading ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : squareConnected ? (
                <div className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {squareConn?.merchant_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Merchant</span>
                        <span className="font-medium">{squareConn.merchant_name}</span>
                      </div>
                    )}
                    {activeLocation?.pos_location_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location</span>
                        <span className="font-medium">{activeLocation.pos_location_name}</span>
                      </div>
                    )}
                    {squareConn?.merchant_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Merchant ID</span>
                        <span className="font-mono text-xs">{squareConn.merchant_id.slice(0, 12)}...</span>
                      </div>
                    )}
                    {squareConn?.last_sync_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last sync</span>
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(squareConn.last_sync_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {squareError && squareConn?.last_sync_status && (
                      <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                        {squareConn.last_sync_status.replace('error: ', '')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-auto pt-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-[#B8E636] text-black hover:bg-[#a5cf2e]"
                      onClick={handleSquareSync}
                      disabled={squareSyncing}
                    >
                      {squareSyncing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {squareSyncing ? 'Syncing...' : squareError ? 'Retry Sync' : 'Sync Now'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setConfirmSquareDisconnect(true)}
                    >
                      <Unplug className="h-4 w-4 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Automatically sync sales, orders, and payment data from Square
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">What syncs:</p>
                    {['Orders', 'Payments', 'Line Items', 'Refunds'].map(item => (
                      <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                        {item}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full mt-auto bg-[#B8E636] text-black hover:bg-[#a5cf2e]"
                    onClick={handleSquareConnect}
                  >
                    <Store className="h-4 w-4 mr-2" />
                    Connect Square
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Xero Card ────────────────────────────────────────────── */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#13B5EA] text-white flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Xero</CardTitle>
                    {xeroConnected && !xeroError && (
                      <Badge className="mt-1 bg-[#13B5EA] text-white">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                    {xeroError && (
                      <Badge variant="destructive" className="mt-1">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Error
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {xeroLoading ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : xeroConnected ? (
                <div className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {xeroConn?.tenant_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Organisation</span>
                        <span className="font-medium">{xeroConn.tenant_name}</span>
                      </div>
                    )}
                    {xeroConn?.last_sync_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last sync</span>
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(xeroConn.last_sync_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {xeroError && xeroConn?.last_sync_status && (
                      <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                        {xeroConn.last_sync_status.replace('error: ', '')}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-auto pt-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-[#13B5EA] text-white hover:bg-[#0fa3d4]"
                      onClick={handleXeroSync}
                      disabled={xeroSyncing}
                    >
                      {xeroSyncing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {xeroSyncing ? 'Syncing...' : xeroError ? 'Retry Sync' : 'Sync Now'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/admin/integrations/xero/mappings')}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Mappings
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setConfirmXeroDisconnect(true)}
                    >
                      <Unplug className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Sync invoices, purchase orders, payroll, and chart of accounts with Xero
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">What syncs:</p>
                    {['Daily Sales Summaries', 'Purchase Order Bills', 'Payroll Journals', 'Chart of Accounts'].map(item => (
                      <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                        {item}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full mt-auto bg-[#13B5EA] text-white hover:bg-[#0fa3d4]"
                    onClick={handleXeroConnect}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Connect Xero
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Requires XERO_CLIENT_ID and XERO_CLIENT_SECRET in Vercel env
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Coming Soon Cards ─────────────────────────────────────── */}
          {COMING_SOON.map((integration) => {
            const Icon = integration.icon
            return (
              <Card key={integration.id} className="flex flex-col opacity-75">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg text-white flex items-center justify-center ${integration.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <Badge variant="outline" className="mt-1 text-xs">
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
                  <Button variant="outline" size="sm" className="w-full mt-auto" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* ── Square Disconnect Dialog ──────────────────────────────────── */}
      <Dialog open={confirmSquareDisconnect} onOpenChange={setConfirmSquareDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Square POS?</DialogTitle>
            <DialogDescription>
              This will stop syncing sales data from Square. Your existing synced data will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSquareDisconnect(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSquareDisconnect}
              disabled={squareDisconnecting}
            >
              {squareDisconnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4 mr-2" />
              )}
              {squareDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Xero Disconnect Dialog ────────────────────────────────────── */}
      <Dialog open={confirmXeroDisconnect} onOpenChange={setConfirmXeroDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Xero?</DialogTitle>
            <DialogDescription>
              This will stop syncing financial data with Xero. Your existing synced data in Xero will be preserved.
              Account mappings will also be retained for when you reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmXeroDisconnect(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleXeroDisconnect}
              disabled={xeroDisconnecting}
            >
              {xeroDisconnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4 mr-2" />
              )}
              {xeroDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
