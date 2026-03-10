"use client"

import { useEffect, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { queryClient } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Plus, ChevronLeft, ChevronRight, Send, Undo2, Save, Clock, Download, Eye, EyeOff } from "lucide-react"
import { format, addDays, startOfWeek, parseISO } from "date-fns"
import { track } from "@/lib/analytics"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface Staff {
  id: string
  orgId: string
  venueId: string | null
  name: string
  email: string
  roleTitle: string
  hourlyRateCents: number
  createdAt: string
}

interface Roster {
  id: string
  orgId: string
  venueId: string
  weekStartDate: string
  createdAt: string
}

interface Shift {
  id: string
  rosterId: string
  staffId: string
  roleTitle: string
  status: string
  startTs: string
  endTs: string
  breakMinutes: number
  createdAt: string
}

interface RosterData {
  roster: Roster
  staff: Staff[]
  shifts: Shift[]
}

interface RosterTemplate {
  id: string
  name: string
  weekday: number | null
  createdAt: string
  lineCount: number
}

interface LabourOverlayHour {
  date: string
  hour: number
  headcountByRole: Record<string, number>
  scheduledCostCents: number
  forecastRevenueCents: number
  labourPct: number
  targetPct: number
}

interface LabourOverlay {
  hours: LabourOverlayHour[]
  summary: {
    totalScheduledCostCents: number
    totalForecastRevenueCents: number
    weekLabourPct: number
    weekTargetPct: number
  }
}

export default function RosterPage() {
  const { toast } = useToast()
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date()
    const monday = startOfWeek(now, { weekStartsOn: 1 })
    return monday
  })
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [isApplyTemplateOpen, setIsApplyTemplateOpen] = useState(false)
  const [templateMode, setTemplateMode] = useState<"save" | "apply">("save")
  const [showOverlay, setShowOverlay] = useState(false)

  // Form state for shift
  const [selectedStaffId, setSelectedStaffId] = useState("")
  const [selectedRoleTitle, setSelectedRoleTitle] = useState("")
  const [startDate, setStartDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endDate, setEndDate] = useState("")
  const [endTime, setEndTime] = useState("")
  const [breakMinutes, setBreakMinutes] = useState("30")

  // Template form state
  const [templateName, setTemplateName] = useState("")
  const [templateWeekday, setTemplateWeekday] = useState<number | null>(null)
  const [templateSourceDate, setTemplateSourceDate] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [templateTargetDate, setTemplateTargetDate] = useState("")

  const weekStart = format(currentWeek, "yyyy-MM-dd")

  const { data, isLoading } = useQuery<RosterData>({
    queryKey: ["/api/labour/roster", weekStart],
    queryFn: async () => {
      const response = await fetch(
        `/api/labour/roster?weekStart=${weekStart}`
      )
      if (!response.ok) {
        throw new Error("Failed to fetch roster")
      }
      return response.json()
    },
  })

  // Fetch labour overlay
  const { data: overlayData } = useQuery<LabourOverlay>({
    queryKey: ["/api/labour/overlay", weekStart],
    queryFn: async () => {
      const response = await fetch(
        `/api/labour/overlay?weekStart=${weekStart}`
      )
      if (!response.ok) {
        throw new Error("Failed to fetch labour overlay")
      }
      return response.json()
    },
    enabled: showOverlay,
  })

  // Fetch templates
  const { data: templatesData } = useQuery<{ templates: RosterTemplate[] }>({
    queryKey: ["/api/roster/templates"],
    queryFn: async () => {
      const response = await fetch("/api/roster/templates")
      if (!response.ok) {
        throw new Error("Failed to fetch templates")
      }
      return response.json()
    },
  })

  const createShiftMutation = useMutation({
    mutationFn: async (shiftData: {
      rosterId: string
      staffId: string
      roleTitle: string
      startTs: string
      endTs: string
      breakMinutes: number
    }) => {
      const response = await fetch("/api/labour/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shiftData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create shift")
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/labour/roster"] })
      setIsAddShiftOpen(false)
      resetForm()
      toast({
        title: "Shift created",
        description: "The shift has been added to the roster",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/roster/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to publish roster")
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/labour/roster"] })
      track("roster_publish", { weekStart, shiftsPublished: data.shiftsPublished })
      toast({
        title: "Roster published",
        description: `${data.shiftsPublished} shifts published for week of ${format(currentWeek, "MMM d")}`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/roster/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to unpublish roster")
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/labour/roster"] })
      track("roster_unpublish", { weekStart })
      toast({
        title: "Roster unpublished",
        description: `${data.shiftsUnpublished} shifts reverted to draft`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: {
      name: string
      weekday: number | null
      sourceDate: string
    }) => {
      const response = await fetch("/api/roster/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save template")
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster/templates"] })
      track("roster_template_saved", { templateId: data.template.id })
      setIsTemplateDialogOpen(false)
      resetTemplateForm()
      toast({
        title: "Template saved",
        description: `Template "${data.template.name}" created with ${data.linesCreated} shift blocks`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const applyTemplateMutation = useMutation({
    mutationFn: async (applyData: {
      templateId: string
      targetDate: string
    }) => {
      const response = await fetch("/api/roster/templates/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(applyData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to apply template")
      }

      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/labour/roster"] })
      track("roster_template_applied", { templateId: selectedTemplateId, shiftsCreated: data.shiftsCreated })
      setIsApplyTemplateOpen(false)
      resetTemplateForm()
      toast({
        title: "Template applied",
        description: `${data.shiftsCreated} draft shifts created`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const generateSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/labour/recommendations/generate?weekStart=${encodeURIComponent(weekStart)}`,
        { method: "POST" }
      )
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate suggestions")
      }
      return response.json()
    },
    onSuccess: () => {
      track("guardrails_generate", { type: "labour_roster" })
      toast({
        title: "Suggestions generated",
        description: "Labour suggestions have been created based on forecasts",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const importSuggestionsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/labour/recommendations/import?weekStart=${encodeURIComponent(weekStart)}`,
        { method: "POST" }
      )
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to import suggestions")
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/labour/roster"] })
      track("roster_imported_draft", { count: data.created })
      toast({
        title: "Suggestions imported",
        description: `${data.created} draft shifts created from ${data.suggestions} suggestions`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  function resetForm() {
    setSelectedStaffId("")
    setSelectedRoleTitle("")
    setStartDate("")
    setStartTime("")
    setEndDate("")
    setEndTime("")
    setBreakMinutes("30")
  }

  function resetTemplateForm() {
    setTemplateName("")
    setTemplateWeekday(null)
    setTemplateSourceDate("")
    setSelectedTemplateId("")
    setTemplateTargetDate("")
  }

  function handlePreviousWeek() {
    setCurrentWeek((prev) => addDays(prev, -7))
  }

  function handleNextWeek() {
    setCurrentWeek((prev) => addDays(prev, 7))
  }

  function handleAddShift() {
    if (!data?.roster) return

    if (!selectedStaffId || !selectedRoleTitle || !startDate || !startTime || !endDate || !endTime) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    const startTs = `${startDate}T${startTime}:00.000Z`
    const endTs = `${endDate}T${endTime}:00.000Z`

    createShiftMutation.mutate({
      rosterId: data.roster.id,
      staffId: selectedStaffId,
      roleTitle: selectedRoleTitle,
      startTs,
      endTs,
      breakMinutes: Number.parseInt(breakMinutes) || 0,
    })
  }

  function handleSaveTemplate() {
    if (!templateName || !templateSourceDate) {
      toast({
        title: "Validation error",
        description: "Please provide template name and source date",
        variant: "destructive",
      })
      return
    }

    saveTemplateMutation.mutate({
      name: templateName,
      weekday: templateWeekday,
      sourceDate: templateSourceDate,
    })
  }

  function handleApplyTemplate() {
    if (!selectedTemplateId || !templateTargetDate) {
      toast({
        title: "Validation error",
        description: "Please select a template and target date",
        variant: "destructive",
      })
      return
    }

    applyTemplateMutation.mutate({
      templateId: selectedTemplateId,
      targetDate: templateTargetDate,
    })
  }

  function handleExportPayroll() {
    const start = weekStart
    const weekEndDate = addDays(currentWeek, 6)
    const end = format(weekEndDate, "yyyy-MM-dd")

    track("payroll_exported", { start, end })

    // Download CSV
    window.open(`/api/workforce/payroll/export?start=${start}&end=${end}`, "_blank")

    toast({
      title: "Export started",
      description: "Payroll CSV is being downloaded",
    })
  }

  function toggleOverlay() {
    const newState = !showOverlay
    setShowOverlay(newState)
    track("roster_overlay_toggled", { on: newState })
  }

  function getLabourPctColor(labourPct: number, targetPct: number): string {
    if (labourPct === 0) return "bg-muted"
    
    const diff = labourPct - targetPct
    if (Math.abs(diff) <= 2) return "bg-green-100 dark:bg-green-900" // Within target
    if (diff > 0) return "bg-red-100 dark:bg-red-900" // Over target
    return "bg-yellow-100 dark:bg-yellow-900" // Under target
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Loading roster data...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Generate array of 7 days starting from Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i))

  // Group shifts by day
  const shiftsByDay: Record<string, Shift[]> = {}
  weekDays.forEach((day) => {
    shiftsByDay[format(day, "yyyy-MM-dd")] = []
  })

  data?.shifts.forEach((shift) => {
    const shiftDate = format(parseISO(shift.startTs), "yyyy-MM-dd")
    if (shiftsByDay[shiftDate]) {
      shiftsByDay[shiftDate].push(shift)
    }
  })

  // Check if week has any published shifts
  const hasPublishedShifts = data?.shifts.some((s) => s.status === "PUBLISHED")
  const hasDraftShifts = data?.shifts.some((s) => s.status === "DRAFT")

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold" data-testid="text-page-title">
              Roster
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePreviousWeek}
                data-testid="button-previous-week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[200px] text-center text-sm font-medium">
                {format(currentWeek, "MMM d")} - {format(addDays(currentWeek, 6), "MMM d, yyyy")}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextWeek}
                data-testid="button-next-week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {hasPublishedShifts && hasDraftShifts && (
              <Badge variant="secondary">Mixed: Draft + Published</Badge>
            )}
            {hasPublishedShifts && !hasDraftShifts && (
              <Badge variant="default">Published</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => generateSuggestionsMutation.mutate()}
              disabled={generateSuggestionsMutation.isPending}
              data-testid="button-generate-suggestions"
            >
              {generateSuggestionsMutation.isPending ? "Generating..." : "Generate AI Suggestions"}
            </Button>
            <Button
              variant="outline"
              onClick={() => importSuggestionsMutation.mutate()}
              disabled={importSuggestionsMutation.isPending}
              data-testid="button-import-suggestions"
            >
              {importSuggestionsMutation.isPending ? "Importing..." : "Import as Draft"}
            </Button>
            <Separator orientation="vertical" className="h-8" />
            <Button
              variant="outline"
              onClick={toggleOverlay}
              data-testid="button-toggle-overlay"
            >
              {showOverlay ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showOverlay ? "Hide" : "Show"} Overlay
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {hasDraftShifts && (
              <Button
                variant="default"
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                data-testid="button-publish"
              >
                <Send className="mr-2 h-4 w-4" />
                {publishMutation.isPending ? "Publishing..." : "Publish Week"}
              </Button>
            )}
            {hasPublishedShifts && (
              <Button
                variant="outline"
                onClick={() => unpublishMutation.mutate()}
                disabled={unpublishMutation.isPending}
                data-testid="button-unpublish"
              >
                <Undo2 className="mr-2 h-4 w-4" />
                {unpublishMutation.isPending ? "Unpublishing..." : "Unpublish"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsTemplateDialogOpen(true)}
              data-testid="button-save-template"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Template
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsApplyTemplateOpen(true)}
              data-testid="button-apply-template"
            >
              <Clock className="mr-2 h-4 w-4" />
              Apply Template
            </Button>
            <Button
              variant="outline"
              onClick={handleExportPayroll}
              data-testid="button-export-payroll"
            >
              <Download className="mr-2 h-4 w-4" />
              Export Payroll
            </Button>
            <Button
              onClick={() => setIsAddShiftOpen(true)}
              data-testid="button-add-shift"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Shift
            </Button>
          </div>
        </div>

        {showOverlay && overlayData && (
          <div className="mt-4 p-4 rounded-md bg-muted">
            <div className="text-sm font-medium mb-2">Week Summary</div>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Scheduled Cost:</span>{" "}
                ${(overlayData.summary.totalScheduledCostCents / 100).toFixed(2)}
              </div>
              <div>
                <span className="text-muted-foreground">Forecast Revenue:</span>{" "}
                ${(overlayData.summary.totalForecastRevenueCents / 100).toFixed(2)}
              </div>
              <div>
                <span className="text-muted-foreground">Labour %:</span>{" "}
                <span className={overlayData.summary.weekLabourPct > overlayData.summary.weekTargetPct ? "text-red-600" : "text-green-600"}>
                  {overlayData.summary.weekLabourPct.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Target %:</span>{" "}
                {overlayData.summary.weekTargetPct.toFixed(1)}%
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading roster...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, index) => {
              const dayKey = format(day, "yyyy-MM-dd")
              const dayShifts = shiftsByDay[dayKey] || []

              return (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      {format(day, "EEE")}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {format(day, "MMM d")}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dayShifts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No shifts</p>
                    ) : (
                      dayShifts.map((shift) => {
                        const staff = data?.staff.find((s) => s.id === shift.staffId)
                        return (
                          <div
                            key={shift.id}
                            className="rounded-md bg-primary/10 p-2 text-xs"
                            data-testid={`shift-${shift.id}`}
                          >
                            <div className="font-medium">{staff?.name || "Unassigned"}</div>
                            <div className="text-muted-foreground">
                              {format(parseISO(shift.startTs), "HH:mm")} -{" "}
                              {format(parseISO(shift.endTs), "HH:mm")}
                            </div>
                            <div className="text-muted-foreground">{shift.roleTitle}</div>
                            <Badge variant={shift.status === "PUBLISHED" ? "default" : "secondary"} className="text-xs mt-1">
                              {shift.status}
                            </Badge>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Shift Dialog */}
      {data && (
        <Dialog open={isAddShiftOpen} onOpenChange={setIsAddShiftOpen}>
          <DialogContent data-testid="dialog-add-shift">
            <DialogHeader>
              <DialogTitle>Add Shift</DialogTitle>
              <DialogDescription>
                Create a new shift for a staff member
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff">Staff Member</Label>
                <Select
                  value={selectedStaffId}
                  onValueChange={setSelectedStaffId}
                >
                  <SelectTrigger id="staff" data-testid="select-staff">
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} - {s.roleTitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleTitle">Role</Label>
                <Input
                  id="roleTitle"
                  value={selectedRoleTitle}
                  onChange={(e) => setSelectedRoleTitle(e.target.value)}
                  placeholder="e.g. FOH, Bar, Kitchen"
                  data-testid="input-role"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="input-start-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    data-testid="input-start-time"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    data-testid="input-end-time"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="breakMinutes">Break (minutes)</Label>
                <Input
                  id="breakMinutes"
                  type="number"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  data-testid="input-break-minutes"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddShiftOpen(false)}
                data-testid="button-cancel-shift"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddShift}
                disabled={createShiftMutation.isPending}
                data-testid="button-save-shift"
              >
                {createShiftMutation.isPending ? "Saving..." : "Save Shift"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Save Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent data-testid="dialog-save-template">
          <DialogHeader>
            <DialogTitle>Save Roster Template</DialogTitle>
            <DialogDescription>
              Save a day's shifts as a reusable template
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Busy Friday"
                data-testid="input-template-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateSourceDate">Source Date</Label>
              <Input
                id="templateSourceDate"
                type="date"
                value={templateSourceDate}
                onChange={(e) => setTemplateSourceDate(e.target.value)}
                data-testid="input-template-source-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateWeekday">Weekday (optional)</Label>
              <Select
                value={templateWeekday?.toString() || "_default_"}
                onValueChange={(v) => setTemplateWeekday(v === "_default_" ? null : parseInt(v))}
              >
                <SelectTrigger id="templateWeekday" data-testid="select-template-weekday">
                  <SelectValue placeholder="Any day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_default_">Any day</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTemplateDialogOpen(false)}
              data-testid="button-cancel-template"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={saveTemplateMutation.isPending}
              data-testid="button-confirm-save-template"
            >
              {saveTemplateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={isApplyTemplateOpen} onOpenChange={setIsApplyTemplateOpen}>
        <DialogContent data-testid="dialog-apply-template">
          <DialogHeader>
            <DialogTitle>Apply Roster Template</DialogTitle>
            <DialogDescription>
              Apply a saved template to create shifts for a specific date
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="selectTemplate">Template</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger id="selectTemplate" data-testid="select-template">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templatesData?.templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.lineCount} blocks)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateTargetDate">Target Date</Label>
              <Input
                id="templateTargetDate"
                type="date"
                value={templateTargetDate}
                onChange={(e) => setTemplateTargetDate(e.target.value)}
                data-testid="input-template-target-date"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApplyTemplateOpen(false)}
              data-testid="button-cancel-apply-template"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={applyTemplateMutation.isPending}
              data-testid="button-confirm-apply-template"
            >
              {applyTemplateMutation.isPending ? "Applying..." : "Apply Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
