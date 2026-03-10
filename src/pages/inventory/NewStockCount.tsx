import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Package,
  Loader2,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { PageShell } from '@/components/shared'
import { formatCurrency } from '@/lib/utils/formatters'
import {
  useCountIngredients,
  useInvLocations,
  useStockCountsList,
  useCreateStockCount,
  useCompleteStockCount,
  type IngredientWithLocation,
} from '@/lib/hooks/useStockCounts'
import {
  calculateVariancePercent,
  calculateVarianceValue,
  isLargeVariance,
  convertUnit,
  generateCountNumber,
} from '@/lib/utils/inventoryCalculations'
import type { StockCount, StockCountItem } from '@/types'

// ── Setup Modal ─────────────────────────────────────────────────────

function SetupModal({
  open,
  onStart,
}: {
  open: boolean
  onStart: (type: 'full' | 'cycle', category?: string) => void
}) {
  const [countType, setCountType] = useState<'full' | 'cycle'>('full')
  const [category, setCategory] = useState<string>('all')
  const { data: ingredients = [] } = useCountIngredients()

  const categories = useMemo(() => {
    const cats = new Set(ingredients.map((i) => i.category || 'Other'))
    return Array.from(cats).sort()
  }, [ingredients])

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            New Stock Count
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Count Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCountType('full')}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  countType === 'full'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
              >
                <p className="font-semibold text-sm">Full Count</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All active ingredients
                </p>
              </button>
              <button
                type="button"
                onClick={() => setCountType('cycle')}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  countType === 'cycle'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30'
                }`}
              >
                <p className="font-semibold text-sm">Cycle Count</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Selected category only
                </p>
              </button>
            </div>
          </div>

          {countType === 'cycle' && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            onClick={() =>
              onStart(
                countType,
                countType === 'cycle' && category !== 'all' ? category : undefined
              )
            }
            disabled={countType === 'cycle' && category === 'all'}
          >
            Start Counting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Ingredient Row (mobile-first) ───────────────────────────────────

function IngredientRow({
  ingredient,
  countedQty,
  altQty,
  onPrimaryChange,
  onAltChange,
  varianceNote,
  onVarianceNoteChange,
}: {
  ingredient: IngredientWithLocation
  countedQty: number
  altQty: number
  onPrimaryChange: (val: number) => void
  onAltChange: (val: number) => void
  varianceNote: string
  onVarianceNoteChange: (val: string) => void
}) {
  const expected = ingredient.current_stock
  const variance = countedQty - expected
  const varPct = calculateVariancePercent(countedQty, expected)
  const varValue = calculateVarianceValue(countedQty, expected, ingredient.cost_per_unit)
  const hasLargeVar = isLargeVariance(
    countedQty,
    expected,
    ingredient.cost_per_unit
  )
  const hasFactor = (ingredient.pack_to_base_factor ?? 0) > 0

  return (
    <div
      className={`p-3 md:p-4 border-b last:border-b-0 transition-colors ${
        hasLargeVar ? 'bg-red-50/60 dark:bg-red-950/20' : ''
      }`}
    >
      {/* Top row: name + variance badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{ingredient.name}</p>
          <p className="text-xs text-muted-foreground">
            {ingredient.product_code ? `${ingredient.product_code} · ` : ''}
            System: {expected} {ingredient.unit}
            {ingredient.par_level > 0 && ` · Par: ${ingredient.par_level}`}
          </p>
        </div>
        {variance !== 0 && (
          <span
            className={`text-xs font-semibold whitespace-nowrap ${
              hasLargeVar
                ? 'text-red-600'
                : variance > 0
                  ? 'text-green-600'
                  : 'text-amber-600'
            }`}
          >
            {variance > 0 ? '+' : ''}
            {varPct.toFixed(0)}% ({formatCurrency(varValue)})
          </span>
        )}
      </div>

      {/* Input row — large touch targets for mobile */}
      <div className="flex items-end gap-3">
        {/* Primary unit input */}
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1 block">
            {ingredient.unit}
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            value={countedQty || ''}
            onChange={(e) => onPrimaryChange(parseFloat(e.target.value) || 0)}
            className={`h-12 text-lg font-medium text-center md:h-10 md:text-base ${
              hasLargeVar ? 'border-red-400 focus-visible:ring-red-400' : ''
            }`}
            placeholder="0"
          />
        </div>

        {/* Alt unit input (packs) */}
        {hasFactor && (
          <div className="w-28 md:w-24">
            <Label className="text-xs text-muted-foreground mb-1 block">
              {ingredient.pack_size_text || 'packs'}
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={altQty || ''}
              onChange={(e) => onAltChange(parseFloat(e.target.value) || 0)}
              className="h-12 text-lg font-medium text-center md:h-10 md:text-base"
              placeholder="0"
            />
          </div>
        )}
      </div>

      {/* Variance note (shown for large variances) */}
      {hasLargeVar && (
        <div className="mt-2">
          <Input
            placeholder="Explain variance..."
            value={varianceNote}
            onChange={(e) => onVarianceNoteChange(e.target.value)}
            className="h-9 text-xs border-red-300"
          />
        </div>
      )}
    </div>
  )
}

// ── Location Section (collapsible) ──────────────────────────────────

function LocationSection({
  title,
  icon,
  items,
  countedQuantities,
  altQuantities,
  varianceNotes,
  onPrimaryChange,
  onAltChange,
  onVarianceNoteChange,
  defaultOpen,
}: {
  title: string
  icon?: React.ReactNode
  items: IngredientWithLocation[]
  countedQuantities: Record<string, number>
  altQuantities: Record<string, number>
  varianceNotes: Record<string, string>
  onPrimaryChange: (id: string, val: number) => void
  onAltChange: (id: string, val: number) => void
  onVarianceNoteChange: (id: string, val: string) => void
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? true)

  const counted = items.filter(
    (i) => (countedQuantities[i.id] ?? 0) !== i.current_stock
  ).length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-4 py-3 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            {icon}
            <span className="font-semibold text-sm flex-1">{title}</span>
            <Badge variant="outline" className="text-xs">
              {counted}/{items.length}
            </Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {items.map((ingredient) => (
            <IngredientRow
              key={ingredient.id}
              ingredient={ingredient}
              countedQty={countedQuantities[ingredient.id] ?? 0}
              altQty={altQuantities[ingredient.id] ?? 0}
              onPrimaryChange={(val) => onPrimaryChange(ingredient.id, val)}
              onAltChange={(val) => onAltChange(ingredient.id, val)}
              varianceNote={varianceNotes[ingredient.id] ?? ''}
              onVarianceNoteChange={(val) =>
                onVarianceNoteChange(ingredient.id, val)
              }
            />
          ))}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ── Main NewStockCount page ─────────────────────────────────────────

export default function NewStockCount() {
  const navigate = useNavigate()
  const { user, profile, currentVenue, currentOrg } = useAuth()
  const { data: ingredients = [], isLoading: ingredientsLoading } =
    useCountIngredients()
  const { data: locations = [] } = useInvLocations()
  const { data: existingCounts = [] } = useStockCountsList()
  const createCount = useCreateStockCount()
  const completeCount = useCompleteStockCount()

  // Setup state
  const [showSetup, setShowSetup] = useState(true)
  const [countType, setCountType] = useState<'full' | 'cycle'>('full')
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>()

  // Count state
  const [countedQuantities, setCountedQuantities] = useState<
    Record<string, number>
  >({})
  const [altQuantities, setAltQuantities] = useState<Record<string, number>>({})
  const [varianceNotes, setVarianceNotes] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Filter ingredients
  const ingredientsToCount = useMemo(() => {
    let items = ingredients
    if (categoryFilter) {
      items = items.filter((i) => i.category === categoryFilter)
    }
    return items
  }, [ingredients, categoryFilter])

  // Group by category (since ingredient_location_assignments don't exist yet,
  // we group by ingredient category as storage location proxy)
  const groupedItems = useMemo(() => {
    const groups: Record<string, IngredientWithLocation[]> = {}

    for (const ing of ingredientsToCount) {
      const key = ing.category || 'Other'
      if (!groups[key]) groups[key] = []
      groups[key].push(ing)
    }

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, items]) => ({
        name,
        items: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
  }, [ingredientsToCount])

  // Initialize counted quantities on setup start
  const handleSetupStart = (
    type: 'full' | 'cycle',
    category?: string
  ) => {
    setCountType(type)
    setCategoryFilter(category)

    // Pre-fill with current_stock
    const initial: Record<string, number> = {}
    const filteredIngs = category
      ? ingredients.filter((i) => i.category === category)
      : ingredients

    for (const ing of filteredIngs) {
      initial[ing.id] = ing.current_stock
    }
    setCountedQuantities(initial)
    setShowSetup(false)
  }

  // Handle primary unit change
  const handlePrimaryChange = useCallback(
    (id: string, val: number) => {
      setCountedQuantities((prev) => ({ ...prev, [id]: val }))
      // Auto-convert to alt unit
      const ing = ingredients.find((i) => i.id === id)
      if (ing?.pack_to_base_factor && ing.pack_to_base_factor > 0) {
        const altVal = convertUnit(val, ing.pack_to_base_factor, false)
        setAltQuantities((prev) => ({ ...prev, [id]: Math.round(altVal * 100) / 100 }))
      }
    },
    [ingredients]
  )

  // Handle alt unit change (packs → base)
  const handleAltChange = useCallback(
    (id: string, val: number) => {
      setAltQuantities((prev) => ({ ...prev, [id]: val }))
      const ing = ingredients.find((i) => i.id === id)
      if (ing?.pack_to_base_factor && ing.pack_to_base_factor > 0) {
        const primaryVal = convertUnit(val, ing.pack_to_base_factor, true)
        setCountedQuantities((prev) => ({
          ...prev,
          [id]: Math.round(primaryVal * 100) / 100,
        }))
      }
    },
    [ingredients]
  )

  const handleVarianceNoteChange = useCallback(
    (id: string, val: string) => {
      setVarianceNotes((prev) => ({ ...prev, [id]: val }))
    },
    []
  )

  // Totals
  const totals = useMemo(() => {
    let totalValue = 0
    let totalVariance = 0
    let largeVarianceCount = 0
    let countedItems = 0

    for (const ing of ingredientsToCount) {
      const counted = countedQuantities[ing.id] ?? 0
      totalValue += counted * ing.cost_per_unit
      const varVal = (counted - ing.current_stock) * ing.cost_per_unit
      totalVariance += varVal

      if (isLargeVariance(counted, ing.current_stock, ing.cost_per_unit)) {
        largeVarianceCount++
      }

      if (counted !== ing.current_stock) {
        countedItems++
      }
    }

    const progress =
      ingredientsToCount.length > 0
        ? (countedItems / ingredientsToCount.length) * 100
        : 0

    return { totalValue, totalVariance, largeVarianceCount, countedItems, progress }
  }, [ingredientsToCount, countedQuantities])

  // Save handler
  const handleSave = async (status: 'in-progress' | 'completed') => {
    if (!currentVenue?.id || currentVenue.id === 'all') {
      toast.error('Select a specific venue before saving')
      return
    }

    if (ingredientsToCount.length === 0) {
      toast.error('No ingredients to count')
      return
    }

    // Validate variance notes for completion
    if (status === 'completed') {
      const missing = ingredientsToCount.filter((ing) => {
        const counted = countedQuantities[ing.id] ?? 0
        return (
          isLargeVariance(counted, ing.current_stock, ing.cost_per_unit) &&
          !varianceNotes[ing.id]?.trim()
        )
      })

      if (missing.length > 0) {
        toast.error(
          missing.length <= 3
            ? `Add variance notes for: ${missing.map((i) => i.name).join(', ')}`
            : `${missing.length} items with large variances need notes`
        )
        return
      }
    }

    setIsSaving(true)

    try {
      const today = format(new Date(), 'yyyyMMdd')
      const todayCounts = existingCounts.filter((sc) =>
        sc.count_number.includes(today)
      )
      const countNumber = generateCountNumber(todayCounts.length)

      const userName = profile?.first_name
        ? `${profile.first_name} ${profile.last_name || ''}`.trim()
        : 'Manager'

      const countId = crypto.randomUUID()

      const items: StockCountItem[] = ingredientsToCount.map((ing) => {
        const countedQty = countedQuantities[ing.id] ?? 0
        const expectedQty = ing.current_stock
        const variance = countedQty - expectedQty
        const varianceValue = variance * ing.cost_per_unit

        return {
          id: crypto.randomUUID(),
          stock_count_id: countId,
          ingredient_id: ing.id,
          ingredient_name: ing.name,
          expected_quantity: expectedQty,
          actual_quantity: countedQty,
          variance,
          variance_value: varianceValue,
        }
      })

      const totalVarianceValue = items.reduce(
        (sum, item) => sum + item.variance_value,
        0
      )

      const stockCount: StockCount = {
        id: countId,
        org_id: currentOrg?.id,
        venue_id: currentVenue.id,
        count_number: countNumber,
        count_date: new Date(),
        count_type: countType,
        status,
        counted_by_user_id: user?.id || '',
        counted_by_name: userName,
        items,
        total_variance_value: totalVarianceValue,
        total_count_value: totals.totalValue,
        notes: notes || undefined,
      }

      await createCount.mutateAsync(stockCount)

      if (status === 'completed') {
        await completeCount.mutateAsync({
          countId,
          items,
        })
        toast.success('Stock count completed and inventory updated')
      } else {
        toast.success('Stock count saved as draft')
      }

      navigate('/inventory/stock-counts')
    } catch {
      toast.error('Failed to save stock count')
    } finally {
      setIsSaving(false)
    }
  }

  // Show setup modal
  if (showSetup) {
    return (
      <PageShell>
        <SetupModal open={showSetup} onStart={handleSetupStart} />
      </PageShell>
    )
  }

  return (
    <PageShell>
      {/* Sticky header + progress */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b shadow-sm">
        {/* Top bar */}
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => navigate('/inventory/stock-counts')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate">
              {countType === 'full' ? 'Full Count' : `Cycle: ${categoryFilter}`}
            </h1>
            <p className="text-xs text-muted-foreground">
              {ingredientsToCount.length} items · {format(new Date(), 'dd MMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave('in-progress')}
              disabled={isSaving}
            >
              <Save className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Draft</span>
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave('completed')}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin md:mr-1" />
              ) : (
                <CheckCircle2 className="h-4 w-4 md:mr-1" />
              )}
              <span className="hidden md:inline">Complete</span>
            </Button>
          </div>
        </div>

        {/* Sticky progress bar */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>
              {totals.countedItems}/{ingredientsToCount.length} counted
            </span>
            <div className="flex items-center gap-3">
              <span>
                Value:{' '}
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.totalValue)}
                </span>
              </span>
              <span>
                Var:{' '}
                <span
                  className={`font-semibold ${
                    totals.totalVariance < 0
                      ? 'text-red-600'
                      : totals.totalVariance > 0
                        ? 'text-green-600'
                        : 'text-foreground'
                  }`}
                >
                  {totals.totalVariance >= 0 ? '+' : ''}
                  {formatCurrency(totals.totalVariance)}
                </span>
              </span>
              {totals.largeVarianceCount > 0 && (
                <Badge variant="destructive" className="gap-0.5 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  {totals.largeVarianceCount}
                </Badge>
              )}
            </div>
          </div>
          <Progress value={totals.progress} className="h-1.5" />
        </div>
      </div>

      {/* Count sheets grouped by location/category */}
      <div className="p-3 md:p-6 space-y-3 pb-24">
        {ingredientsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groupedItems.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              No ingredients available. Add ingredients first.
            </p>
          </Card>
        ) : (
          groupedItems.map((group, idx) => (
            <LocationSection
              key={group.name}
              title={group.name}
              icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
              items={group.items}
              countedQuantities={countedQuantities}
              altQuantities={altQuantities}
              varianceNotes={varianceNotes}
              onPrimaryChange={handlePrimaryChange}
              onAltChange={handleAltChange}
              onVarianceNoteChange={handleVarianceNoteChange}
              defaultOpen={idx === 0}
            />
          ))
        )}

        {/* Notes */}
        {!ingredientsLoading && groupedItems.length > 0 && (
          <Card className="p-4">
            <Label htmlFor="count-notes" className="text-sm font-medium">
              Count Notes
            </Label>
            <Textarea
              id="count-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this count..."
              rows={2}
              className="mt-2"
            />
          </Card>
        )}
      </div>

      {/* Mobile floating action bar */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white dark:bg-gray-800 border-t p-3 flex gap-2 z-20">
        <Button
          variant="outline"
          className="flex-1 h-12"
          onClick={() => handleSave('in-progress')}
          disabled={isSaving}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Draft
        </Button>
        <Button
          className="flex-1 h-12"
          onClick={() => handleSave('completed')}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-2" />
          )}
          Complete Count
        </Button>
      </div>
    </PageShell>
  )
}
