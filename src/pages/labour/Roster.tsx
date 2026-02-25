import { useAuth } from "@/contexts/AuthContext"
import { useState, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  TooltipProvider,
} from "@/components/ui/tooltip"
import {
  Clock,
  Users,
  AlertTriangle,
  Save,
  UserPlus,
  Send,
  Check,
} from "lucide-react"
import { useDataStore } from "@/lib/store/dataStore"
import { ShiftDialog } from "@/components/ShiftDialog"
import { AvailabilityDialog } from "@/components/AvailabilityDialog"
import { ShiftSwapDialog, SwapRequestsPanel } from "@/components/ShiftSwapDialog"
import { RosterShift, LaborBudget, ShiftTemplate, StaffAvailability, RosterViewMode, RosterDisplayMode, RosterGroupBy } from "@/types"
import {
  getWeekStart,
  getWeekDates,
  getFortnightDates,
  getMonthDates,
  getShiftsForWeek,
  getShiftsForDateRange,
  getShiftsForDay,
  calculateWeeklyRosterMetrics,
  calculateHourlyStaffing,
  calculateDayStats,
  detectOvertimeWarnings,
  detectRestGapWarnings,
  detectBreakWarnings,
  calculateBudgetVariance,
  formatLabourCost,
} from "@/lib/utils/rosterCalculations"
import { format, addDays, addMonths, startOfMonth } from "date-fns"
import { toast } from "sonner"

// Sub-components
import { RosterToolbar } from "@/components/roster/RosterToolbar"
import { RosterSidebar } from "@/components/roster/RosterSidebar"
import { RosterStaffView } from "@/components/roster/RosterStaffView"
import { RosterStackedView } from "@/components/roster/RosterStackedView"
import { RosterDayView } from "@/components/roster/RosterDayView"
import { RosterMonthView } from "@/components/roster/RosterMonthView"

export default function Roster() {
  const { currentVenue } = useAuth()
  const navigate = useNavigate()
  const {
    staff,
    rosterShifts,
    addRosterShift,
    updateRosterShift,
    deleteRosterShift,
    copyPreviousWeekRoster,
    shiftTemplates,
    addShiftTemplate,
    laborBudgets,
    addLaborBudget,
    updateLaborBudget,
    getLaborBudgetForWeek,
    claimOpenShift,
    staffAvailability,
    shiftSwapRequests,
  } = useDataStore()

  const activeStaff = staff.filter((s) => s.status === "active")
  const printRef = useRef<HTMLDivElement>(null)

  // ── View State ──
  const [viewMode, setViewMode] = useState<RosterViewMode>("week")
  const [displayMode, setDisplayMode] = useState<RosterDisplayMode>("staff")
  const [groupBy, setGroupBy] = useState<RosterGroupBy>("none")
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date())

  // ── Dialog States ──
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [selectedShift, setSelectedShift] = useState<RosterShift | undefined>()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>()
  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [shiftToDelete, setShiftToDelete] = useState<RosterShift | null>(null)
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [claimDialogOpen, setClaimDialogOpen] = useState(false)
  const [shiftToClaim, setShiftToClaim] = useState<RosterShift | null>(null)
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)
  const [selectedAvailabilityStaffId, setSelectedAvailabilityStaffId] = useState<string | undefined>()
  const [swapDialogOpen, setSwapDialogOpen] = useState(false)
  const [shiftToSwap, setShiftToSwap] = useState<RosterShift | null>(null)
  const [swapRequestsPanelOpen, setSwapRequestsPanelOpen] = useState(false)
  const [budgetAmount, setBudgetAmount] = useState("")
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateStartTime, setTemplateStartTime] = useState("09:00")
  const [templateEndTime, setTemplateEndTime] = useState("17:00")
  const [templateBreak, setTemplateBreak] = useState("30")

  // ── Computed Dates + Shifts ──
  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart])

  const currentDates = useMemo(() => {
    switch (viewMode) {
      case "day": return [selectedDay]
      case "week": return weekDates
      case "fortnight": return getFortnightDates(currentWeekStart)
      case "month": return getMonthDates(currentWeekStart)
    }
  }, [viewMode, currentWeekStart, selectedDay, weekDates])

  const weekShifts = useMemo(
    () => getShiftsForWeek(rosterShifts, currentWeekStart),
    [rosterShifts, currentWeekStart]
  )

  const currentShifts = useMemo(() => {
    if (viewMode === "week") return weekShifts
    if (viewMode === "day") return getShiftsForDay(rosterShifts, selectedDay)
    const start = currentDates[0]
    const end = currentDates[currentDates.length - 1]
    return getShiftsForDateRange(rosterShifts, start, end)
  }, [viewMode, rosterShifts, currentWeekStart, selectedDay, weekShifts, currentDates])

  // Fortnight dates and shifts for day view navigation strip
  const fortnightDates = useMemo(() => getFortnightDates(getWeekStart(selectedDay)), [selectedDay])
  const fortnightShifts = useMemo(() => {
    const start = fortnightDates[0]
    const end = fortnightDates[fortnightDates.length - 1]
    return getShiftsForDateRange(rosterShifts, start, end)
  }, [rosterShifts, fortnightDates])

  // Day view specific data
  const hourlyStaffing = useMemo(
    () => viewMode === "day" ? calculateHourlyStaffing(rosterShifts, selectedDay) : [],
    [viewMode, rosterShifts, selectedDay]
  )

  const dayStats = useMemo(
    () => viewMode === "day" ? calculateDayStats(rosterShifts, selectedDay) : undefined,
    [viewMode, rosterShifts, selectedDay]
  )

  // ── Metrics + Warnings ──
  const metrics = useMemo(() => calculateWeeklyRosterMetrics(weekShifts), [weekShifts])

  const currentBudget = useMemo(
    () => getLaborBudgetForWeek(currentWeekStart),
    [currentWeekStart, laborBudgets]
  )

  const budgetVariance = useMemo(
    () => calculateBudgetVariance(currentBudget, metrics.totalCost),
    [currentBudget, metrics.totalCost]
  )

  const overtimeWarnings = useMemo(() => detectOvertimeWarnings(weekShifts), [weekShifts])
  const restGapWarnings = useMemo(() => detectRestGapWarnings(weekShifts), [weekShifts])
  const breakWarnings = useMemo(() => detectBreakWarnings(weekShifts), [weekShifts])

  const allWarnings = useMemo(() => [
    ...overtimeWarnings.map((w) => ({ ...w, type: "overtime" as const })),
    ...restGapWarnings.map((w) => ({ ...w, type: "rest_gap" as const, staffId: w.staff_id, staffName: w.staff_name, warning: w.message })),
    ...breakWarnings.map((w) => ({ ...w, type: "break" as const, staffId: w.staff_id, staffName: w.staff_name, warning: w.message })),
  ], [overtimeWarnings, restGapWarnings, breakWarnings])

  const openShifts = useMemo(() => weekShifts.filter((s) => s.is_open_shift), [weekShifts])
  const pendingSwapCount = useMemo(() => shiftSwapRequests.filter((r) => r.status === "pending").length, [shiftSwapRequests])

  // ── Data Functions (passed to sub-components) ──
  const getStaffWeeklyHours = (staffId: string) =>
    weekShifts
      .filter((s) => s.staff_id === staffId && s.status !== "cancelled" && !s.is_open_shift)
      .reduce((sum, s) => sum + s.total_hours, 0)

  const getDayTotals = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    const dayShifts = (viewMode === "week" ? weekShifts : currentShifts).filter((s) => {
      const shiftDate = new Date(s.date).toISOString().split("T")[0]
      return shiftDate === dateStr && s.status !== "cancelled"
    })
    return {
      hours: dayShifts.reduce((sum, s) => sum + s.total_hours, 0),
      cost: dayShifts.reduce((sum, s) => sum + s.total_cost, 0),
      count: dayShifts.length,
    }
  }

  const getAvailabilityForStaffOnDate = (staffId: string, date: Date): StaffAvailability | null => {
    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().split("T")[0]
    const specificAvail = staffAvailability.find(
      (a) => a.staff_id === staffId && !a.is_recurring && a.specific_date &&
        new Date(a.specific_date).toISOString().split("T")[0] === dateStr
    )
    if (specificAvail) return specificAvail
    return staffAvailability.find(
      (a) => a.staff_id === staffId && a.is_recurring && a.day_of_week === dayOfWeek
    ) || null
  }

  const getShiftsForStaffOnDate = (staffId: string, date: Date) => {
    const dateStr = date.toISOString().split("T")[0]
    return (viewMode === "week" ? weekShifts : currentShifts).filter((s) => {
      const shiftDate = new Date(s.date).toISOString().split("T")[0]
      return s.staff_id === staffId && shiftDate === dateStr && s.status !== "cancelled" && !s.is_open_shift
    })
  }

  // ── Navigation ──
  const navigateBack = () => {
    switch (viewMode) {
      case "day": setSelectedDay((prev) => addDays(prev, -1)); break
      case "week": setCurrentWeekStart((prev) => addDays(prev, -7)); break
      case "fortnight": setCurrentWeekStart((prev) => addDays(prev, -14)); break
      case "month": setCurrentWeekStart((prev) => startOfMonth(addMonths(prev, -1))); break
    }
  }

  const navigateForward = () => {
    switch (viewMode) {
      case "day": setSelectedDay((prev) => addDays(prev, 1)); break
      case "week": setCurrentWeekStart((prev) => addDays(prev, 7)); break
      case "fortnight": setCurrentWeekStart((prev) => addDays(prev, 14)); break
      case "month": setCurrentWeekStart((prev) => startOfMonth(addMonths(prev, 1))); break
    }
  }

  const dateRangeLabel = useMemo(() => {
    switch (viewMode) {
      case "day": return format(selectedDay, "EEE d MMM")
      case "week": return `${format(currentWeekStart, "d MMM")} - ${format(addDays(currentWeekStart, 6), "d MMM")}`
      case "fortnight": return `${format(currentWeekStart, "d MMM")} - ${format(addDays(currentWeekStart, 13), "d MMM")}`
      case "month": return format(currentWeekStart, "MMMM yyyy")
    }
  }, [viewMode, currentWeekStart, selectedDay])

  const handleViewModeChange = (mode: RosterViewMode) => {
    setViewMode(mode)
    if (mode === "day") {
      setSelectedDay(new Date())
    } else if (mode === "month") {
      setCurrentWeekStart(startOfMonth(currentWeekStart))
    }
  }

  // ── Shift Handlers ──
  const handleAddShift = (date?: Date, staffId?: string) => {
    setSelectedShift(undefined)
    setSelectedDate(date)
    setSelectedStaffId(staffId)
    setShiftDialogOpen(true)
  }

  const handleEditShift = (shift: RosterShift) => {
    setSelectedShift(shift)
    setSelectedDate(undefined)
    setSelectedStaffId(undefined)
    setShiftDialogOpen(true)
  }

  const handleDeleteShift = (shift: RosterShift) => {
    setShiftToDelete(shift)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteShift = () => {
    if (shiftToDelete) {
      deleteRosterShift(shiftToDelete.id)
      toast.success("Shift deleted")
      setDeleteDialogOpen(false)
      setShiftToDelete(null)
    }
  }

  const handleSaveShift = (shift: RosterShift) => {
    if (selectedShift) {
      updateRosterShift(shift.id, shift)
    } else {
      addRosterShift(shift)
    }
  }

  const handleCopyPreviousWeek = () => {
    copyPreviousWeekRoster(currentWeekStart)
    toast.success("Previous week's roster copied")
  }

  const handleRequestSwap = (shift: RosterShift) => {
    setShiftToSwap(shift)
    setSwapDialogOpen(true)
  }

  const handleAddAvailability = (staffId?: string) => {
    setSelectedAvailabilityStaffId(staffId)
    setAvailabilityDialogOpen(true)
  }

  // ── Budget Handlers ──
  const handleSaveBudget = () => {
    const amount = parseFloat(budgetAmount) * 100
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid budget amount")
      return
    }
    const weekEnd = addDays(currentWeekStart, 6)
    if (currentBudget) {
      updateLaborBudget(currentBudget.id, { budgeted_amount: amount })
      toast.success("Budget updated")
    } else {
      const newBudget: LaborBudget = {
        id: `budget-${Date.now()}`,
        venue_id: currentVenue?.id || "",
        period_type: "weekly",
        period_start: currentWeekStart,
        period_end: weekEnd,
        budgeted_amount: amount,
        warning_threshold_percent: 90,
        critical_threshold_percent: 100,
        created_at: new Date(),
        updated_at: new Date(),
      }
      addLaborBudget(newBudget)
      toast.success("Budget set")
    }
    setBudgetDialogOpen(false)
    setBudgetAmount("")
  }

  // ── Template Handlers ──
  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast.error("Please enter a template name")
      return
    }
    const template: ShiftTemplate = {
      id: `template-${Date.now()}`,
      organization_id: "org-1",
      venue_id: currentVenue?.id || "",
      name: templateName,
      start_time: templateStartTime,
      end_time: templateEndTime,
      break_minutes: parseInt(templateBreak) || 30,
      role: "crew",
      days_of_week: [],
      usage_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }
    addShiftTemplate(template)
    toast.success("Template saved")
    setTemplateDialogOpen(false)
    setTemplateName("")
  }

  // ── Claim / Publish ──
  const handleClaimShift = (shift: RosterShift) => {
    setShiftToClaim(shift)
    setClaimDialogOpen(true)
  }

  const confirmClaimShift = (staffId: string) => {
    if (shiftToClaim) {
      const staffMember = activeStaff.find((s) => s.id === staffId)
      if (staffMember) {
        claimOpenShift(shiftToClaim.id, staffId, staffMember.name)
        toast.success(`Shift claimed by ${staffMember.name}`)
      }
    }
    setClaimDialogOpen(false)
    setShiftToClaim(null)
  }

  const handlePublishRoster = async () => {
    setIsPublishing(true)
    try {
      const draftShifts = weekShifts.filter((s) => s.status === "scheduled")
      for (const shift of draftShifts) {
        updateRosterShift(shift.id, { status: "confirmed" })
      }
      toast.success(`Published ${draftShifts.length} shifts`, {
        action: { label: "View Timesheets", onClick: () => navigate("/workforce/timesheets") },
      })
      setPublishDialogOpen(false)
    } catch {
      toast.error("Failed to publish roster")
    } finally {
      setIsPublishing(false)
    }
  }

  const publishStats = useMemo(() => {
    const draftShifts = weekShifts.filter((s) => s.status === "scheduled")
    const confirmedShifts = weekShifts.filter((s) => s.status === "confirmed")
    const staffWithShifts = new Set(draftShifts.map((s) => s.staff_id)).size
    const totalCost = draftShifts.reduce((sum, s) => sum + s.total_cost, 0)
    const totalHours = draftShifts.reduce((sum, s) => sum + s.total_hours, 0)
    return { draftShifts, confirmedShifts, staffWithShifts, totalCost, totalHours }
  }, [weekShifts])

  // ── Render ──
  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-64px)] print:h-auto" ref={printRef}>
        {/* Left Sidebar */}
        <RosterSidebar
          metrics={metrics}
          allWarnings={allWarnings}
          pendingSwapCount={pendingSwapCount}
          dayStats={dayStats}
          shiftTemplates={shiftTemplates}
          onCopyPreviousWeek={handleCopyPreviousWeek}
          onApplyTemplate={(template) => {
            handleAddShift()
            toast.info(`Template "${template.name}" selected — fill in the shift details`)
          }}
          onEventsComments={() => setSwapRequestsPanelOpen(true)}
          onTools={() => setBudgetDialogOpen(true)}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
          {/* Toolbar */}
          <RosterToolbar
            dateRangeLabel={dateRangeLabel}
            viewMode={viewMode}
            displayMode={displayMode}
            groupBy={groupBy}
            onNavigateBack={navigateBack}
            onNavigateForward={navigateForward}
            onViewModeChange={handleViewModeChange}
            onDisplayModeChange={setDisplayMode}
            onGroupByChange={setGroupBy}
            onCopyPreviousWeek={handleCopyPreviousWeek}
            onSaveTemplate={() => setTemplateDialogOpen(true)}
            onPrint={() => window.print()}
            onManageAvailability={() => handleAddAvailability()}
            onPublish={() => setPublishDialogOpen(true)}
            publishDisabled={weekShifts.filter((s) => s.status === "scheduled").length === 0}
            onBackToFortnight={viewMode === "day" ? () => setViewMode("fortnight") : undefined}
          />

          {/* View Content */}
          <div className="flex-1 overflow-auto">
            {viewMode === "day" ? (
              <RosterDayView
                selectedDay={selectedDay}
                fortnightDates={fortnightDates}
                shifts={currentShifts}
                allShifts={fortnightShifts}
                staff={activeStaff}
                hourlyStaffing={hourlyStaffing}
                dayStats={dayStats!}
                onDaySelect={setSelectedDay}
                onAddShift={handleAddShift}
                onEditShift={handleEditShift}
                onDeleteShift={handleDeleteShift}
                onRequestSwap={handleRequestSwap}
              />
            ) : viewMode === "month" ? (
              <RosterMonthView
                monthDates={currentDates}
                shifts={currentShifts}
                getDayTotals={getDayTotals}
                onDayClick={(date) => {
                  setSelectedDay(date)
                  setViewMode("day")
                }}
                onAddShift={handleAddShift}
              />
            ) : displayMode === "stacked" ? (
              <RosterStackedView
                dates={currentDates}
                shifts={currentShifts}
                staff={activeStaff}
                groupBy={groupBy}
                getDayTotals={getDayTotals}
                onAddShift={handleAddShift}
                onEditShift={handleEditShift}
                onDeleteShift={handleDeleteShift}
                onRequestSwap={handleRequestSwap}
              />
            ) : (
              <RosterStaffView
                dates={currentDates}
                activeStaff={activeStaff}
                weekShifts={currentShifts}
                staffAvailability={staffAvailability}
                groupBy={groupBy}
                compact={viewMode === "fortnight"}
                getShiftsForStaffOnDate={getShiftsForStaffOnDate}
                getAvailabilityForStaffOnDate={getAvailabilityForStaffOnDate}
                getStaffWeeklyHours={getStaffWeeklyHours}
                getDayTotals={getDayTotals}
                onAddShift={handleAddShift}
                onEditShift={handleEditShift}
                onDeleteShift={handleDeleteShift}
                onRequestSwap={handleRequestSwap}
                onAddAvailability={handleAddAvailability}
              />
            )}
          </div>

          {/* Open Shifts Banner */}
          {openShifts.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-950 border-t p-3 print:hidden">
              <div className="flex items-center gap-3">
                <UserPlus className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {openShifts.length} Open Shift{openShifts.length > 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  {openShifts.slice(0, 3).map((shift) => (
                    <Button
                      key={shift.id}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-white"
                      onClick={() => handleClaimShift(shift)}
                    >
                      {format(new Date(shift.date), "EEE d")} • {shift.start_time}-{shift.end_time}
                    </Button>
                  ))}
                  {openShifts.length > 3 && (
                    <Badge variant="secondary">+{openShifts.length - 3} more</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── All Dialogs ── */}
        <ShiftDialog
          open={shiftDialogOpen}
          onOpenChange={setShiftDialogOpen}
          shift={selectedShift}
          defaultDate={selectedDate}
          onSave={handleSaveShift}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Shift</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this shift for {shiftToDelete?.staff_name}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteShift} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Weekly Labor Budget</DialogTitle>
              <DialogDescription>
                Set a target labor cost for the week of {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="budget">Budget Amount ($)</Label>
                <Input id="budget" type="number" placeholder="3500.00" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} />
              </div>
              {currentBudget && (
                <p className="text-sm text-muted-foreground">
                  Current budget: {formatLabourCost(currentBudget.budgeted_amount)}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBudgetDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveBudget}>{currentBudget ? "Update Budget" : "Set Budget"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Shift Template</DialogTitle>
              <DialogDescription>Create a reusable shift template for quick scheduling</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template-name">Template Name</Label>
                <Input id="template-name" placeholder="e.g., Weekend Dinner" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="template-start">Start Time</Label>
                  <Input id="template-start" type="time" value={templateStartTime} onChange={(e) => setTemplateStartTime(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="template-end">End Time</Label>
                  <Input id="template-end" type="time" value={templateEndTime} onChange={(e) => setTemplateEndTime(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="template-break">Break (mins)</Label>
                  <Input id="template-break" type="number" value={templateBreak} onChange={(e) => setTemplateBreak(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveTemplate}>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Claim Open Shift</DialogTitle>
              <DialogDescription>
                {shiftToClaim && (
                  <>Shift on {format(new Date(shiftToClaim.date), "EEEE, MMM d")} from {shiftToClaim.start_time} to {shiftToClaim.end_time}</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Select Staff Member</Label>
              <div className="space-y-2">
                {activeStaff.map((s) => (
                  <Button key={s.id} variant="outline" className="w-full justify-start" onClick={() => confirmClaimShift(s.id)}>
                    <Users className="h-4 w-4 mr-2" />
                    {s.name} ({s.role})
                  </Button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClaimDialogOpen(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AvailabilityDialog
          open={availabilityDialogOpen}
          onOpenChange={setAvailabilityDialogOpen}
          staffId={selectedAvailabilityStaffId}
        />

        <ShiftSwapDialog
          open={swapDialogOpen}
          onOpenChange={setSwapDialogOpen}
          shift={shiftToSwap}
        />

        <SwapRequestsPanel
          open={swapRequestsPanelOpen}
          onOpenChange={setSwapRequestsPanelOpen}
        />

        {/* Publish Dialog */}
        <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-teal-500" />
                Publish Roster
              </DialogTitle>
              <DialogDescription>
                Review and publish the roster for {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-2xl font-bold">{publishStats.draftShifts.length}</div>
                  <div className="text-xs text-muted-foreground">Shifts to publish</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-2xl font-bold">{publishStats.staffWithShifts}</div>
                  <div className="text-xs text-muted-foreground">Staff rostered</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-2xl font-bold">{publishStats.totalHours.toFixed(1)}h</div>
                  <div className="text-xs text-muted-foreground">Total hours</div>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-2xl font-bold">{formatLabourCost(publishStats.totalCost)}</div>
                  <div className="text-xs text-muted-foreground">Total cost</div>
                </div>
              </div>
              {allWarnings.length > 0 && (
                <div className="rounded-lg bg-orange-50 dark:bg-orange-950 p-3 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{allWarnings.length} warnings</span>
                  </div>
                  <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                    Review overtime and compliance warnings before publishing
                  </p>
                </div>
              )}
              {publishStats.confirmedShifts.length > 0 && (
                <div className="rounded-lg bg-green-50 dark:bg-green-950 p-3 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    <span className="font-medium">{publishStats.confirmedShifts.length} shifts already published</span>
                  </div>
                </div>
              )}
              {publishStats.draftShifts.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No draft shifts to publish</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>Cancel</Button>
              <Button onClick={handlePublishRoster} disabled={isPublishing || publishStats.draftShifts.length === 0} className="bg-teal-500 hover:bg-teal-600">
                {isPublishing ? <>Publishing...</> : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Publish {publishStats.draftShifts.length} Shifts
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
