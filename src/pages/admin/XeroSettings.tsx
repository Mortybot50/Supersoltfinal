/**
 * XeroSettings — Account mapping UI for the Xero integration.
 * Maps SuperSolt financial categories to Xero chart of accounts.
 * Accessed via Settings > Integrations > Xero > Configure Mappings.
 */
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Save, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

// ── Types ─────────────────────────────────────────────────────

interface XeroAccount {
  AccountID: string
  Code: string
  Name: string
  Type: string
}

interface AccountMapping {
  supersolt_category: string
  xero_account_id: string | null
  xero_account_code: string | null
  xero_account_name: string | null
}

// All SuperSolt financial categories with display labels grouped by section
const CATEGORIES = [
  {
    group: 'Revenue',
    items: [
      { key: 'revenue_food',       label: 'Food Sales' },
      { key: 'revenue_beverage',   label: 'Beverage Sales' },
    ],
  },
  {
    group: 'Cost of Goods Sold',
    items: [
      { key: 'cogs_food',          label: 'Food COGS' },
      { key: 'cogs_beverage',      label: 'Beverage COGS' },
    ],
  },
  {
    group: 'Labour',
    items: [
      { key: 'labour_wages',       label: 'Wages & Salaries' },
      { key: 'labour_super',       label: 'Superannuation' },
    ],
  },
  {
    group: 'GST',
    items: [
      { key: 'gst_collected',      label: 'GST Collected' },
      { key: 'gst_paid',           label: 'GST Paid' },
    ],
  },
  {
    group: 'Overheads',
    items: [
      { key: 'overhead_rent',       label: 'Rent' },
      { key: 'overhead_utilities',  label: 'Utilities' },
      { key: 'overhead_marketing',  label: 'Marketing' },
    ],
  },
]

export default function XeroSettings() {
  const { currentOrg } = useAuth()

  const [xeroAccounts, setXeroAccounts] = useState<XeroAccount[]>([])
  const [mappings, setMappings] = useState<Record<string, AccountMapping>>({})
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [loadingMappings, setLoadingMappings] = useState(true)
  const [saving, setSaving] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  // ── Load existing mappings from DB ─────────────────────────────
  const loadMappings = useCallback(async () => {
    if (!currentOrg) return
    setLoadingMappings(true)
    try {
      const { data, error } = await supabase
        .from('xero_account_mappings' as 'pos_connections')
        .select('supersolt_category, xero_account_id, xero_account_code, xero_account_name')
        .eq('org_id', currentOrg.id) as {
          data: AccountMapping[] | null
          error: unknown
        }

      if (error) throw error

      const map: Record<string, AccountMapping> = {}
      for (const m of data ?? []) {
        map[m.supersolt_category] = m
      }
      setMappings(map)
    } catch {
      toast.error('Failed to load account mappings')
    } finally {
      setLoadingMappings(false)
    }
  }, [currentOrg])

  useEffect(() => {
    loadMappings()
  }, [loadMappings])

  // ── Load Xero chart of accounts ─────────────────────────────────
  const loadXeroAccounts = useCallback(async () => {
    if (!currentOrg) return
    setLoadingAccounts(true)
    setAccountsError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/xero/api?action=accounts&org_id=${currentOrg.id}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const json = await res.json() as { accounts?: XeroAccount[]; error?: string }
      if (!res.ok) {
        setAccountsError(json.error ?? 'Failed to load Xero accounts')
        return
      }
      setXeroAccounts(json.accounts ?? [])
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : 'Failed to connect to Xero')
    } finally {
      setLoadingAccounts(false)
    }
  }, [currentOrg])

  useEffect(() => {
    loadXeroAccounts()
  }, [loadXeroAccounts])

  // ── Handle mapping change ────────────────────────────────────────
  const handleMappingChange = (category: string, accountId: string) => {
    const account = xeroAccounts.find(a => a.AccountID === accountId)
    setMappings(prev => ({
      ...prev,
      [category]: {
        supersolt_category: category,
        xero_account_id: account?.AccountID ?? null,
        xero_account_code: account?.Code ?? null,
        xero_account_name: account?.Name ?? null,
      },
    }))
  }

  // ── Save all mappings ────────────────────────────────────────────
  const handleSave = async () => {
    if (!currentOrg) return
    setSaving(true)
    try {
      const rows = Object.values(mappings)
        .filter(m => m.xero_account_id)
        .map(m => ({ org_id: currentOrg.id, ...m }))

      const { error } = await supabase
        .from('xero_account_mappings' as 'pos_connections')
        .upsert(rows as Record<string, unknown>[], { onConflict: 'org_id,supersolt_category' }) as { error: unknown }

      if (error) throw error
      toast.success('Account mappings saved')
    } catch {
      toast.error('Failed to save account mappings')
    } finally {
      setSaving(false)
    }
  }

  if (loadingMappings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Xero Account Mapping</h2>
          <p className="text-sm text-muted-foreground">
            Map SuperSolt categories to your Xero chart of accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadXeroAccounts}
            disabled={loadingAccounts}
          >
            {loadingAccounts ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1.5">Refresh Accounts</span>
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Save Mappings
          </Button>
        </div>
      </div>

      {accountsError && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Could not load Xero accounts: {accountsError}. Showing saved mappings only.</span>
        </div>
      )}

      {CATEGORIES.map((group) => (
        <Card key={group.group}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {group.group}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.items.map(({ key, label }) => {
              const current = mappings[key]
              return (
                <div key={key} className="flex items-center gap-4">
                  <div className="w-40 shrink-0">
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <div className="flex-1">
                    {xeroAccounts.length > 0 ? (
                      <Select
                        value={current?.xero_account_id ?? ''}
                        onValueChange={(val) => handleMappingChange(key, val)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select Xero account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {xeroAccounts.map(account => (
                            <SelectItem key={account.AccountID} value={account.AccountID}>
                              <span className="font-mono text-xs text-muted-foreground mr-2">
                                {account.Code}
                              </span>
                              {account.Name}
                              <Badge variant="outline" className="ml-2 text-xs py-0">
                                {account.Type}
                              </Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-8 flex items-center text-sm text-muted-foreground">
                        {current?.xero_account_code
                          ? `${current.xero_account_code} — ${current.xero_account_name}`
                          : 'Not mapped'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">AU Hospitality Defaults</CardTitle>
          <CardDescription className="text-xs">
            These are pre-filled with standard Xero AU chart of accounts codes for hospitality venues.
            Codes: Revenue 200, COGS 310, Wages 477, Super 478, GST 820, Rent 493, Utilities 489, Marketing 400.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
