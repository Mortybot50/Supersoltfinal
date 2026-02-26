import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  FileText,
  BookOpen,
  Users,
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────
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

// ── Coming-soon card config ─────────────────────────────────────────
const COMING_SOON = [
  {
    id: 'xero',
    name: 'Xero',
    description: 'Sync invoices, bills, and chart of accounts',
    icon: FileText,
    color: 'bg-[#13B5EA]',
  },
  {
    id: 'myob',
    name: 'MYOB',
    description: 'Sync payroll, invoices, and financial data',
    icon: BookOpen,
    color: 'bg-purple-700',
  },
  {
    id: 'deputy',
    name: 'Deputy / Tanda',
    description: 'Sync rosters and timesheets',
    icon: Users,
    color: 'bg-blue-600',
  },
]

export default function Integrations() {
  const { currentOrg, currentVenue } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [connection, setConnection] = useState<PosConnection | null>(null)
  const [locations, setLocations] = useState<LocationMapping[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  // ── Load connection status ────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!currentOrg) return
      try {
        const { data: conn } = await supabase
          .from('pos_connections')
          .select('id, provider, merchant_id, merchant_name, is_active, last_sync_at, last_sync_status, created_at')
          .eq('org_id', currentOrg.id)
          .eq('provider', 'square')
          .single()

        if (conn && conn.is_active) {
          setConnection(conn)
          // Fetch location mappings
          const { data: locs } = await supabase
            .from('pos_location_mappings')
            .select('pos_location_id, pos_location_name, venue_id, is_active')
            .eq('pos_connection_id', conn.id)
          setLocations(locs ?? [])
        } else {
          setConnection(null)
          setLocations([])
        }
      } catch {
        // No connection found
        setConnection(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentOrg])

  // ── Handle URL params (post-OAuth redirects) ──────────────────
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected === 'square') {
      toast.success('Square POS connected successfully!')
      setSearchParams({}, { replace: true })
      // Reload connection
      setLoading(true)
      setTimeout(() => window.location.reload(), 500)
    } else if (error) {
      const messages: Record<string, string> = {
        token_exchange_failed: 'Failed to connect to Square. Please try again.',
        db_error: 'Connection saved but there was a database error.',
        unknown: 'An unexpected error occurred during connection.',
      }
      toast.error(messages[error] ?? `Connection error: ${error}`)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // ── Connect handler ───────────────────────────────────────────
  const handleConnect = async () => {
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

  // ── Sync handler ──────────────────────────────────────────────
  const handleSync = async () => {
    if (!currentOrg || !currentVenue) return
    setSyncing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/square/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ org_id: currentOrg.id, venue_id: currentVenue.id }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Synced ${data.synced} new orders`)
        // Refresh connection to update last_sync_at
        const { data: updated } = await supabase
          .from('pos_connections')
          .select('id, provider, merchant_id, merchant_name, is_active, last_sync_at, last_sync_status, created_at')
          .eq('org_id', currentOrg.id)
          .eq('provider', 'square')
          .single()
        if (updated) setConnection(updated)
      } else {
        toast.error(data.error ?? 'Sync failed')
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Sync request failed')
    } finally {
      setSyncing(false)
    }
  }

  // ── Disconnect handler ────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!currentOrg) return
    setDisconnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/square/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ org_id: currentOrg.id }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Square POS disconnected')
        setConnection(null)
        setLocations([])
      } else {
        toast.error(data.error ?? 'Disconnect failed')
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Disconnect request failed')
    } finally {
      setDisconnecting(false)
      setConfirmDisconnect(false)
    }
  }

  // ── Status helpers ────────────────────────────────────────────
  const isConnected = connection?.is_active === true
  const isError = isConnected && connection?.last_sync_status?.startsWith('error')
  const activeLocation = locations.find((l) => l.is_active)

  const toolbar = <PageToolbar title="Integrations" />

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 md:p-6 space-y-6">
        <p className="text-sm text-muted-foreground">
          Connect your POS, accounting, and other tools
        </p>

        {/* Integration cards grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Square POS Card ──────────────────────────────────── */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center font-bold text-sm">
                    SQ
                  </div>
                  <div>
                    <CardTitle className="text-base">Square POS</CardTitle>
                    {isConnected && !isError && (
                      <Badge className="mt-1 bg-[#B8E636] text-black hover:bg-[#a5cf2e]">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                    {isError && (
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
              {loading ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : isConnected ? (
                /* ── Connected state ─────────────────────────────── */
                <div className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {connection?.merchant_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Merchant</span>
                        <span className="font-medium">{connection.merchant_name}</span>
                      </div>
                    )}
                    {activeLocation?.pos_location_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location</span>
                        <span className="font-medium">{activeLocation.pos_location_name}</span>
                      </div>
                    )}
                    {connection?.merchant_id && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Merchant ID</span>
                        <span className="font-mono text-xs">{connection.merchant_id.slice(0, 12)}...</span>
                      </div>
                    )}
                    {connection?.last_sync_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last sync</span>
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {isError && connection?.last_sync_status && (
                      <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                        {connection.last_sync_status.replace('error: ', '')}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-auto pt-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-[#B8E636] text-black hover:bg-[#a5cf2e]"
                      onClick={handleSync}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {syncing ? 'Syncing...' : isError ? 'Retry Sync' : 'Sync Now'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setConfirmDisconnect(true)}
                    >
                      <Unplug className="h-4 w-4 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                /* ── Disconnected state ──────────────────────────── */
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Automatically sync sales, orders, and payment data from Square
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">What syncs:</p>
                    {['Orders', 'Payments', 'Line Items', 'Refunds'].map((item) => (
                      <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                        {item}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full mt-auto bg-[#B8E636] text-black hover:bg-[#a5cf2e]"
                    onClick={handleConnect}
                  >
                    <Store className="h-4 w-4 mr-2" />
                    Connect Square
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Coming Soon Cards ────────────────────────────────── */}
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

      {/* ── Disconnect Confirmation Dialog ───────────────────────── */}
      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Square POS?</DialogTitle>
            <DialogDescription>
              This will stop syncing sales data from Square. Your existing synced data will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisconnect(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4 mr-2" />
              )}
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
