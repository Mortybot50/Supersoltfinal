/**
 * Roster page — new redesign.
 * Replaces the legacy Roster.tsx (moved to RosterLegacy.tsx).
 * Commit 1: static grid with store.
 */

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRosterStore } from '@/stores/useRosterStore'
import { RosterHeader } from '@/components/roster/RosterHeader'
import { RosterGrid } from '@/components/roster/RosterGrid'
import { RosterShift } from '@/types'
import { toast } from 'sonner'

export default function Roster() {
  const { currentVenue, currentOrg } = useAuth()
  const { init, deleteShift, selectShift, selectedDate, loadWeek } = useRosterStore()

  // Initialise store when venue/org are available
  useEffect(() => {
    if (currentVenue?.id && currentOrg?.id) {
      init(currentVenue.id, currentOrg.id)
    }
  }, [currentVenue?.id, currentOrg?.id])

  // Reload when selectedDate changes externally (navigateWeek updates it)
  useEffect(() => {
    if (currentVenue?.id) {
      loadWeek(selectedDate)
    }
  }, [selectedDate])

  const handleAddShift = (date: Date, staffId: string) => {
    // TODO commit 2: open shift dialog / drag-create
    toast.info(`Add shift for ${date.toDateString()} — drag-to-add coming in next commit`)
  }

  const handleSelectShift = (shift: RosterShift) => {
    selectShift(shift.id)
    // TODO commit 3: open ShiftDetailPanel
  }

  const handleDeleteShift = async (shift: RosterShift) => {
    if (window.confirm(`Delete shift for ${shift.staff_name} on ${new Date(shift.date).toDateString()}?`)) {
      await deleteShift(shift.id)
      toast.success('Shift deleted')
    }
  }

  const handlePublish = () => {
    // TODO commit 5: open PublishDialog
    toast.info('Publish dialog — coming in commit 5')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      <RosterHeader onPublish={handlePublish} />

      <div className="flex flex-1 overflow-hidden">
        {/* Main grid */}
        <RosterGrid
          onAddShift={handleAddShift}
          onSelectShift={handleSelectShift}
          onDeleteShift={handleDeleteShift}
        />
      </div>
    </div>
  )
}
