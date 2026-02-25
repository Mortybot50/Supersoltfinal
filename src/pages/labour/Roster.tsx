/**
 * Roster page — new redesign.
 * Commit 4: compliance engine — ComplianceSummary, CoverageHeatmap, ComplianceIcon.
 */

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRosterStore } from '@/stores/useRosterStore'
import { RosterHeader } from '@/components/roster/RosterHeader'
import { RosterGrid } from '@/components/roster/RosterGrid'
import { StaffSidebar } from '@/components/roster/StaffSidebar'
import { CostBar } from '@/components/roster/CostBar'
import { CostBarExpanded } from '@/components/roster/CostBarExpanded'
import { ShiftDetailPanel } from '@/components/roster/ShiftDetailPanel'
import { ComplianceSummary } from '@/components/roster/ComplianceSummary'
import { RosterShift } from '@/types'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAllRosterWarnings } from '@/lib/utils/rosterCalculations'

export default function Roster() {
  const { currentVenue, currentOrg } = useAuth()
  const {
    init, deleteShift, selectShift, selectedDate, loadWeek,
    sidebarOpen, selectedShiftId,
    shifts, availability,
  } = useRosterStore()

  const [showCompliance, setShowCompliance] = useState(false)

  useEffect(() => {
    if (currentVenue?.id && currentOrg?.id) {
      init(currentVenue.id, currentOrg.id)
    }
  }, [currentVenue?.id, currentOrg?.id])

  useEffect(() => {
    if (currentVenue?.id) {
      loadWeek(selectedDate)
    }
  }, [selectedDate])

  const handleAddShift = (_date: Date, _staffId: string) => {
    toast.info('Drag a staff card from the sidebar to schedule')
  }

  const handleSelectShift = (shift: RosterShift) => {
    selectShift(shift.id)
  }

  const handleDeleteShift = async (shift: RosterShift) => {
    const d = shift.date instanceof Date ? shift.date : new Date(shift.date)
    if (window.confirm(`Delete shift for ${shift.staff_name} on ${d.toDateString()}?`)) {
      await deleteShift(shift.id)
      toast.success('Shift deleted')
    }
  }

  const handlePublish = () => {
    // TODO commit 5: PublishDialog
    toast.info('Publish dialog — coming in commit 5')
  }

  const warningCount = getAllRosterWarnings(shifts, availability).length

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      <RosterHeader onPublish={handlePublish} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left staff sidebar */}
        {sidebarOpen && <StaffSidebar />}

        {/* Main grid */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <RosterGrid
            onAddShift={handleAddShift}
            onSelectShift={handleSelectShift}
            onDeleteShift={handleDeleteShift}
          />

          {/* Compliance panel (collapsible) */}
          {showCompliance && (
            <div className="border-t bg-white shrink-0 max-h-72 overflow-y-auto">
              <ComplianceSummary onClose={() => setShowCompliance(false)} />
            </div>
          )}
        </div>

        {/* Right detail panel */}
        {selectedShiftId && <ShiftDetailPanel />}
      </div>

      {/* Bottom: compliance toggle + cost bar */}
      <div className="flex items-center gap-2 px-3 py-1 bg-white border-t print:hidden">
        <Button
          variant={warningCount > 0 ? 'outline' : 'ghost'}
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowCompliance(v => !v)}
        >
          <AlertTriangle className={warningCount > 0 ? 'h-3.5 w-3.5 text-orange-500' : 'h-3.5 w-3.5 text-gray-400'} />
          {warningCount > 0 ? `${warningCount} issue${warningCount === 1 ? '' : 's'}` : 'Compliance'}
        </Button>
      </div>

      <CostBar />
      <CostBarExpanded />
    </div>
  )
}
