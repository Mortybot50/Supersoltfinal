/**
 * Roster page — new redesign.
 * Commit 3: live CostBar + ShiftDetailPanel.
 */

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRosterStore } from '@/stores/useRosterStore'
import { RosterHeader } from '@/components/roster/RosterHeader'
import { RosterGrid } from '@/components/roster/RosterGrid'
import { StaffSidebar } from '@/components/roster/StaffSidebar'
import { CostBar } from '@/components/roster/CostBar'
import { CostBarExpanded } from '@/components/roster/CostBarExpanded'
import { ShiftDetailPanel } from '@/components/roster/ShiftDetailPanel'
import { RosterShift } from '@/types'
import { toast } from 'sonner'

export default function Roster() {
  const { currentVenue, currentOrg } = useAuth()
  const {
    init, deleteShift, selectShift, selectedDate, loadWeek,
    sidebarOpen, selectedShiftId,
  } = useRosterStore()

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
    // Drag a staff card from the sidebar, or click the + button
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

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      <RosterHeader onPublish={handlePublish} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left staff sidebar */}
        {sidebarOpen && <StaffSidebar />}

        {/* Main grid */}
        <RosterGrid
          onAddShift={handleAddShift}
          onSelectShift={handleSelectShift}
          onDeleteShift={handleDeleteShift}
        />

        {/* Right detail panel */}
        {selectedShiftId && <ShiftDetailPanel />}
      </div>

      {/* Bottom cost bar */}
      <CostBar />
      <CostBarExpanded />
    </div>
  )
}
