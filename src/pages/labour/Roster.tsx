/**
 * Roster page — new redesign.
 * Commit 6: sales forecast overlay, prep load, real-time Supabase subscriptions.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRosterStore } from '@/stores/useRosterStore'
import { RosterHeader } from '@/components/roster/RosterHeader'
import { RosterGrid } from '@/components/roster/RosterGrid'
import { RosterDndWrapper } from '@/components/roster/RosterDndWrapper'
import { StaffSidebar } from '@/components/roster/StaffSidebar'
import { CostBar } from '@/components/roster/CostBar'
import { CostBarExpanded } from '@/components/roster/CostBarExpanded'
import { ShiftDetailPanel } from '@/components/roster/ShiftDetailPanel'
import { ComplianceSummary } from '@/components/roster/ComplianceSummary'
import { OpenShiftBanner } from '@/components/roster/OpenShiftBanner'
import { PublishDialog } from '@/components/roster/PublishDialog'
import { ShiftTemplateDialog } from '@/components/roster/ShiftTemplateDialog'
import { AutoFillDialog } from '@/components/roster/AutoFillDialog'
import { RosterShift } from '@/types'
import { toast } from 'sonner'
import { AlertTriangle, Wand2, BookTemplate, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAllRosterWarnings } from '@/lib/utils/rosterCalculations'

export default function Roster() {
  const { currentVenue, currentOrg } = useAuth()
  const {
    init, deleteShift, selectShift, selectedDate, loadWeek,
    sidebarOpen, selectedShiftId,
    shifts, availability, openShifts,
    subscribeToChanges, staff, setPendingShift,
  } = useRosterStore()

  const [showCompliance, setShowCompliance] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showAutoFill, setShowAutoFill] = useState(false)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (currentVenue?.id && currentOrg?.id) {
      init(currentVenue.id, currentOrg.id)
    }
  }, [currentVenue?.id, currentOrg?.id, init])

  const selectedDateTs = selectedDate?.getTime()
  useEffect(() => {
    if (currentVenue?.id && selectedDate) {
      loadWeek(selectedDate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateTs, currentVenue?.id])

  // Real-time subscription
  useEffect(() => {
    if (!currentVenue?.id) return
    const unsubscribe = subscribeToChanges()
    setIsLive(true)
    return () => {
      unsubscribe()
      setIsLive(false)
    }
  }, [currentVenue?.id, subscribeToChanges])

  const handleAddShift = (date: Date, staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId)
    if (!staffMember || !currentVenue?.id) return
    setPendingShift({
      staffId: staffMember.id,
      staffName: staffMember.name,
      date,
      defaultRole: staffMember.role,
      venueId: currentVenue.id,
      employmentType: staffMember.employment_type || 'casual',
      hourlyRateCents: staffMember.hourly_rate ?? 0,
    })
  }

  const handleSelectShift = (shift: RosterShift) => {
    selectShift(shift.id)
  }

  const handleDeleteShift = async (shift: RosterShift) => {
    await deleteShift(shift.id)
    toast.success('Shift deleted')
  }

  const warningCount = getAllRosterWarnings(shifts, availability).length
  const openCount = openShifts.filter(s => {
    const d = s.date instanceof Date ? s.date : new Date(s.date)
    const end = new Date(selectedDate); end.setDate(end.getDate() + 6)
    return d >= selectedDate && d <= end
  }).length

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      <RosterHeader onPublish={() => setShowPublish(true)} />

      <RosterDndWrapper>
      <div className="flex flex-1 overflow-hidden">
        {/* Left staff sidebar */}
        {sidebarOpen && <StaffSidebar />}

        {/* Main content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <RosterGrid
            onAddShift={handleAddShift}
            onSelectShift={handleSelectShift}
            onDeleteShift={handleDeleteShift}
          />

          {/* Open shifts banner */}
          <OpenShiftBanner />

          {/* Compliance panel */}
          {showCompliance && (
            <div className="border-t bg-white shrink-0 max-h-72 overflow-y-auto">
              <ComplianceSummary onClose={() => setShowCompliance(false)} />
            </div>
          )}
        </div>

        {/* Right detail panel */}
        {selectedShiftId && <ShiftDetailPanel />}
      </div>
      </RosterDndWrapper>

      {/* Footer tool strip */}
      <div className="flex items-center gap-2 px-3 py-1 bg-white border-t print:hidden shrink-0">
        {/* Compliance toggle */}
        <Button
          variant={warningCount > 0 ? 'outline' : 'ghost'}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowCompliance(v => !v)}
        >
          <AlertTriangle className={warningCount > 0 ? 'h-3.5 w-3.5 text-orange-500' : 'h-3.5 w-3.5 text-gray-400'} />
          {warningCount > 0 ? `${warningCount} issue${warningCount !== 1 ? 's' : ''}` : 'Compliance'}
        </Button>

        {/* Templates */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowTemplates(true)}
        >
          <BookTemplate className="h-3.5 w-3.5 text-gray-400" />
          Templates
        </Button>

        {/* Auto-fill */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowAutoFill(true)}
        >
          <Wand2 className="h-3.5 w-3.5 text-purple-500" />
          Auto-fill
        </Button>

        <div className="flex-1" />

        {/* Live indicator */}
        {isLive && (
          <div className="flex items-center gap-1 text-[10px] text-green-600">
            <Radio className="h-3 w-3" />
            <span>Live</span>
          </div>
        )}
      </div>

      {/* Cost bar */}
      <CostBar />
      <CostBarExpanded />

      {/* Dialogs */}
      <PublishDialog open={showPublish} onOpenChange={setShowPublish} />
      <ShiftTemplateDialog open={showTemplates} onOpenChange={setShowTemplates} />
      <AutoFillDialog open={showAutoFill} onOpenChange={setShowAutoFill} />
    </div>
  )
}
