import { useState } from "react"
import { Link } from "react-router-dom"
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, startOfYear, endOfYear, subYears } from "date-fns"
import { DollarSign, TrendingUp, ShoppingCart, Users, Receipt, BarChart3, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageShell, PageToolbar } from "@/components/shared"

type PLPreset = "this-month" | "last-month" | "this-quarter" | "last-quarter" | "this-year" | "last-year"

function getPLDateRange(preset: PLPreset): { from: Date; to: Date; label: string } {
  const now = new Date()
  switch (preset) {
    case "this-month":
      return { from: startOfMonth(now), to: endOfMonth(now), label: format(now, "MMMM yyyy") }
    case "last-month": {
      const lm = subMonths(now, 1)
      return { from: startOfMonth(lm), to: endOfMonth(lm), label: format(lm, "MMMM yyyy") }
    }
    case "this-quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now), label: `Q${Math.ceil((now.getMonth() + 1) / 3)} ${format(now, "yyyy")}` }
    case "last-quarter": {
      const lq = subQuarters(now, 1)
      return { from: startOfQuarter(lq), to: endOfQuarter(lq), label: `Q${Math.ceil((lq.getMonth() + 1) / 3)} ${format(lq, "yyyy")}` }
    }
    case "this-year":
      return { from: startOfYear(now), to: endOfYear(now), label: `FY ${format(now, "yyyy")}` }
    case "last-year": {
      const ly = subYears(now, 1)
      return { from: startOfYear(ly), to: endOfYear(ly), label: `FY ${format(ly, "yyyy")}` }
    }
  }
}

const DASH = "—"

interface PLRow {
  label: string
  value: string
  icon?: React.ElementType
  emphasis?: "total" | "profit" | "loss" | "subtotal"
}

function PLSection({
  title,
  rows,
  icon: Icon,
}: {
  title: string
  rows: PLRow[]
  icon: React.ElementType
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between py-1.5 px-3 rounded-md ${
                row.emphasis === "total"
                  ? "bg-slate-100 dark:bg-slate-800 font-semibold"
                  : row.emphasis === "profit"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 font-semibold text-emerald-700 dark:text-emerald-400"
                  : row.emphasis === "loss"
                  ? "bg-red-50 dark:bg-red-950/30 font-semibold text-red-700 dark:text-red-400"
                  : row.emphasis === "subtotal"
                  ? "border-t pt-2 mt-1"
                  : ""
              }`}
            >
              <span className="text-sm">{row.label}</span>
              <span className="text-sm tabular-nums">{row.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProfitAndLoss() {
  const [preset, setPreset] = useState<PLPreset>("this-month")
  const { label } = getPLDateRange(preset)

  const toolbar = (
    <PageToolbar
      title="P&L"
      filters={
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={(v) => setPreset(v as PLPreset)}>
            <SelectTrigger className="h-9 w-[160px] border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-quarter">This Quarter</SelectItem>
              <SelectItem value="last-quarter">Last Quarter</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground hidden sm:inline">{label}</span>
        </div>
      }
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      {/* Connect Xero banner */}
      <div className="px-6 pt-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-4 flex items-start gap-3">
          <BarChart3 className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
              P&L data will appear here once Xero is connected
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              Connect your Xero account to automatically pull income, COGS, payroll and expense data into your P&L.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400">
            <Link to="/admin/integrations">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Connect Xero
            </Link>
          </Button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-4">
        <PLSection
          title="Revenue"
          icon={TrendingUp}
          rows={[
            { label: "Food Sales", value: DASH },
            { label: "Beverage Sales", value: DASH },
            { label: "Other Revenue", value: DASH },
            { label: "Total Revenue", value: DASH, emphasis: "total" },
          ]}
        />

        <PLSection
          title="COGS"
          icon={ShoppingCart}
          rows={[
            { label: "Food COGS", value: DASH },
            { label: "Beverage COGS", value: DASH },
            { label: "Total COGS", value: DASH, emphasis: "total" },
          ]}
        />

        <PLSection
          title="Labour"
          icon={Users}
          rows={[
            { label: "Wages", value: DASH },
            { label: "Superannuation", value: DASH },
            { label: "Payroll Tax", value: DASH },
            { label: "Total Labour", value: DASH, emphasis: "total" },
          ]}
        />

        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Gross Profit</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">{DASH}</span>
            </div>
          </CardContent>
        </Card>

        <PLSection
          title="Operating Expenses"
          icon={Receipt}
          rows={[
            { label: "Rent & Occupancy", value: DASH },
            { label: "Utilities", value: DASH },
            { label: "Marketing", value: DASH },
            { label: "Insurance", value: DASH },
            { label: "Depreciation", value: DASH },
            { label: "Other Expenses", value: DASH },
            { label: "Total Expenses", value: DASH, emphasis: "total" },
          ]}
        />

        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Net Profit</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">{DASH}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
