/**
 * Dedicated Zustand store for the new roster redesign.
 * Handles all roster state, Supabase operations, and real-time subscriptions.
 * Does NOT use the monolith dataStore — roster data lives here only.
 */

import { create } from 'zustand'
import { RosterShift, Staff, StaffAvailability, ShiftTemplate } from '@/types'
import { supabase } from '@/integrations/supabase/client'
import {
  loadStaffFromDB,
  loadRosterShiftsFromDB,
  loadShiftTemplatesFromDB,
  loadStaffAvailabilityFromDB,
  addRosterShiftToDB,
  updateRosterShiftInDB,
  deleteRosterShiftFromDB,
  publishRosterShifts,
} from '@/lib/services/labourService'
import { getWeekStart } from '@/lib/utils/rosterCalculations'
import { addDays, format } from 'date-fns'
import { toast } from 'sonner'

// ── Role Colors ─────────────────────────────────────────────────────────────

export const ROLE_COLORS = {
  kitchen: { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800', dot: 'bg-orange-500' },
  bar: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800', dot: 'bg-purple-500' },
  foh: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', dot: 'bg-blue-500' },
  management: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800', dot: 'bg-slate-500' },
  manager: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800', dot: 'bg-slate-500' },
  supervisor: { bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800', dot: 'bg-teal-500' },
  crew: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800', dot: 'bg-amber-500' },
  default: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-800', dot: 'bg-gray-500' },
} as const

type RoleColorKey = keyof typeof ROLE_COLORS

export function getRoleColors(role: string) {
  const key = role.toLowerCase() as RoleColorKey
  return ROLE_COLORS[key] ?? ROLE_COLORS.default
}

export function getDaypart(startTime: string): 'am' | 'lunch' | 'pm' | 'close' {
  const [h] = startTime.split(':').map(Number)
  if (h >= 6 && h < 11) return 'am'
  if (h >= 11 && h < 14) return 'lunch'
  if (h >= 14 && h < 18) return 'pm'
  return 'close'
}

// ── Store Interface ───────────────────────────────────────────────────────────

interface RosterStore {
  // Context (set by page component on mount)
  venueId: string | null
  orgId: string | null

  // View state
  view: 'week' | 'day' | 'fortnight'
  selectedDate: Date // Monday of current week for week/fortnight, any day for day view
  selectedDayIndex: number // 0–6 for day view
  isDraft: boolean

  // Data
  shifts: RosterShift[]
  ghostShifts: RosterShift[] // last week's shifts for overlay
  staff: Staff[]
  availability: StaffAvailability[]
  templates: ShiftTemplate[]
  openShifts: RosterShift[]

  // Loading
  isLoading: boolean

  // Filters
  roleFilter: string | null
  searchQuery: string

  // UI state
  selectedShiftId: string | null
  expandedRoles: Set<string>
  costBarExpanded: boolean
  sidebarOpen: boolean

  // ── Actions ──────────────────────────────────────────────────────────────

  // Bootstrap
  init: (venueId: string, orgId: string) => Promise<void>

  // Navigation
  setView: (view: 'week' | 'day' | 'fortnight') => void
  navigateWeek: (direction: 1 | -1) => void
  setSelectedDay: (date: Date) => void

  // Filters
  setSearchQuery: (q: string) => void
  setRoleFilter: (role: string | null) => void

  // Shift CRUD (DB-first)
  addShift: (shift: Partial<RosterShift>) => Promise<void>
  updateShift: (id: string, updates: Partial<RosterShift>) => Promise<void>
  moveShift: (id: string, newStaffId: string, newDate: Date) => Promise<void>
  deleteShift: (id: string) => Promise<void>

  // Roster ops
  publishRoster: (weekStart: Date) => Promise<void>
  loadWeek: (weekStart: Date) => Promise<void>

  // UI
  selectShift: (id: string | null) => void
  toggleRole: (role: string) => void
  toggleCostBar: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  // Real-time
  subscribeToChanges: () => () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase row shape varies by query
function mapShiftRow(row: any): RosterShift {
  return {
    id: row.id,
    venue_id: row.venue_id,
    staff_id: row.staff_id,
    staff_name: row.staff_name || '',
    date: new Date(row.shift_date || row.date),
    start_time: row.start_time,
    end_time: row.end_time,
    break_minutes: row.break_duration_mins ?? row.break_minutes ?? 0,
    role: row.position || row.role || 'crew',
    notes: row.notes,
    status: row.status === 'draft' ? 'scheduled' : (row.status || 'scheduled'),
    is_open_shift: row.is_open_shift || false,
    total_hours: calcHours(row.start_time, row.end_time, row.break_duration_mins ?? row.break_minutes ?? 0),
    base_cost: Math.round((row.base_cost || 0) * 100),
    penalty_cost: Math.round((row.penalty_cost || 0) * 100),
    total_cost: Math.round((row.estimated_cost || row.total_cost || 0) * 100),
    penalty_type: row.penalty_type || 'none',
    penalty_multiplier: row.penalty_rate || row.penalty_multiplier || 1,
    template_id: row.template_id,
  }
}

function calcHours(start: string, end: string, breakMins: number): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return Math.max(0, (mins - breakMins) / 60)
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useRosterStore = create<RosterStore>((set, get) => ({
  venueId: null,
  orgId: null,

  view: 'week',
  selectedDate: getWeekStart(new Date()),
  selectedDayIndex: 0,
  isDraft: true,

  shifts: [],
  ghostShifts: [],
  staff: [],
  availability: [],
  templates: [],
  openShifts: [],

  isLoading: false,

  roleFilter: null,
  searchQuery: '',

  selectedShiftId: null,
  expandedRoles: new Set<string>(),
  costBarExpanded: false,
  sidebarOpen: false,

  // ── Bootstrap ──────────────────────────────────────────────────────────

  init: async (venueId, orgId) => {
    // Guard: don't re-init if already set to same venue
    if (get().venueId === venueId && get().staff.length > 0) return

    set({ venueId, orgId })

    try {
      const [staff, templates, availability] = await Promise.all([
        loadStaffFromDB(),
        loadShiftTemplatesFromDB(venueId),
        loadStaffAvailabilityFromDB(),
      ])

      // Default all roles expanded
      const roles = [...new Set(staff.map(s => s.role))]
      const expandedRoles = new Set<string>(roles)

      set({ staff, templates, availability, expandedRoles })
    } catch (e) {
      console.error('[RosterStore] init error:', e)
    }

    // Load current week
    await get().loadWeek(get().selectedDate)
  },

  // ── Navigation ──────────────────────────────────────────────────────────

  setView: (view) => set({ view }),

  navigateWeek: (direction) => {
    const { view, selectedDate } = get()
    const days = view === 'fortnight' ? 14 : 7
    const next = addDays(selectedDate, direction * days)
    const weekStart = getWeekStart(next)
    set({ selectedDate: weekStart })
    get().loadWeek(weekStart)
  },

  setSelectedDay: (date) => {
    set({ selectedDate: date, selectedDayIndex: date.getDay() === 0 ? 6 : date.getDay() - 1 })
  },

  // ── Filters ─────────────────────────────────────────────────────────────

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setRoleFilter: (roleFilter) => set({ roleFilter }),

  // ── Shift CRUD ──────────────────────────────────────────────────────────

  addShift: async (partial) => {
    const { venueId, orgId, shifts } = get()
    if (!venueId || !orgId) return

    const id = `shift-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newShift: RosterShift = {
      id,
      venue_id: venueId,
      staff_id: partial.staff_id || '',
      staff_name: partial.staff_name || '',
      date: partial.date || new Date(),
      start_time: partial.start_time || '09:00',
      end_time: partial.end_time || '17:00',
      break_minutes: partial.break_minutes ?? 30,
      role: partial.role || 'crew',
      notes: partial.notes,
      status: 'scheduled',
      is_open_shift: partial.is_open_shift || false,
      total_hours: partial.total_hours || 0,
      base_cost: partial.base_cost || 0,
      penalty_cost: partial.penalty_cost || 0,
      total_cost: partial.total_cost || 0,
      penalty_type: partial.penalty_type || 'none',
      penalty_multiplier: partial.penalty_multiplier || 1,
      template_id: partial.template_id,
    }

    // Optimistic update
    set({ shifts: [...shifts, newShift], openShifts: newShift.is_open_shift ? [...get().openShifts, newShift] : get().openShifts })

    const saved = await addRosterShiftToDB(newShift, orgId)
    if (!saved) {
      // Rollback
      set({ shifts: get().shifts.filter(s => s.id !== id) })
    }
  },

  updateShift: async (id, updates) => {
    const prev = get().shifts.find(s => s.id === id)

    // Optimistic update
    set({
      shifts: get().shifts.map(s => s.id === id ? { ...s, ...updates } : s),
      openShifts: get().openShifts.map(s => s.id === id ? { ...s, ...updates } : s),
    })

    const ok = await updateRosterShiftInDB(id, updates)
    if (!ok && prev) {
      set({ shifts: get().shifts.map(s => s.id === id ? prev : s) })
    }
  },

  moveShift: async (id, newStaffId, newDate) => {
    const staffMember = get().staff.find(s => s.id === newStaffId)
    await get().updateShift(id, {
      staff_id: newStaffId,
      staff_name: staffMember?.name || '',
      date: newDate,
    })
  },

  deleteShift: async (id) => {
    const prev = get().shifts.find(s => s.id === id)

    // Optimistic
    set({
      shifts: get().shifts.filter(s => s.id !== id),
      openShifts: get().openShifts.filter(s => s.id !== id),
      selectedShiftId: get().selectedShiftId === id ? null : get().selectedShiftId,
    })

    const ok = await deleteRosterShiftFromDB(id)
    if (!ok && prev) {
      set({ shifts: [...get().shifts, prev] })
    }
  },

  // ── Roster Ops ──────────────────────────────────────────────────────────

  loadWeek: async (weekStart) => {
    const { venueId } = get()
    if (!venueId) return

    const normalised = getWeekStart(weekStart)
    const current = get().selectedDate
    const dateChanged = normalised.getTime() !== current.getTime()
    set({ isLoading: true, ...(dateChanged ? { selectedDate: normalised } : {}) })

    try {
      const weekEnd = addDays(weekStart, 6)
      const weekStartStr = format(weekStart, 'yyyy-MM-dd')
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

      // Previous week for ghost shifts
      const prevStart = addDays(weekStart, -7)
      const prevEnd = addDays(weekStart, -1)
      const prevStartStr = format(prevStart, 'yyyy-MM-dd')
      const prevEndStr = format(prevEnd, 'yyyy-MM-dd')

      // Load current + previous week in parallel
      /* eslint-disable @typescript-eslint/no-explicit-any -- Supabase join query not captured by auto-gen types */
      const [curData, prevData] = await Promise.all([
        (supabase as any)
          .from('roster_shifts')
          .select(`*, staff!inner(id, org_members!inner(profiles!inner(first_name, last_name)))`)
          .eq('venue_id', venueId)
          .gte('shift_date', weekStartStr)
          .lte('shift_date', weekEndStr),
        (supabase as any)
          .from('roster_shifts')
          .select('*')
          .eq('venue_id', venueId)
          .gte('shift_date', prevStartStr)
          .lte('shift_date', prevEndStr),
      ])
      /* eslint-enable @typescript-eslint/no-explicit-any */

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join row shape
      const mapWithName = (row: any): RosterShift => {
        const firstName = row.staff?.org_members?.profiles?.first_name || ''
        const lastName = row.staff?.org_members?.profiles?.last_name || ''
        return { ...mapShiftRow(row), staff_name: `${firstName} ${lastName}`.trim() || row.staff_name || '' }
      }

      const shifts = (curData.data || []).map(mapWithName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase row
      const ghostShifts = (prevData.data || []).map((r: any) => mapShiftRow(r))
      const openShifts = shifts.filter((s: RosterShift) => s.is_open_shift)

      set({ shifts, ghostShifts, openShifts })
    } catch (e) {
      console.error('[RosterStore] loadWeek error:', e)
      toast.error('Failed to load roster')
    } finally {
      set({ isLoading: false })
    }
  },

  publishRoster: async (weekStart) => {
    const { shifts } = get()
    const weekEnd = addDays(weekStart, 6)
    const toPublish = shifts.filter(s => {
      if (s.status !== 'scheduled') return false
      const d = s.date instanceof Date ? s.date : new Date(s.date)
      return d >= weekStart && d <= weekEnd
    })

    if (toPublish.length === 0) {
      toast.info('No draft shifts to publish')
      return
    }

    const ids = toPublish.map(s => s.id)
    const ok = await publishRosterShifts(ids)
    if (ok) {
      set({
        shifts: get().shifts.map(s => ids.includes(s.id) ? { ...s, status: 'confirmed' } : s),
      })
      toast.success(`Published ${ids.length} shift${ids.length === 1 ? '' : 's'}`)
    }
  },

  // ── UI ──────────────────────────────────────────────────────────────────

  selectShift: (selectedShiftId) => set({ selectedShiftId }),

  toggleRole: (role) => {
    const next = new Set(get().expandedRoles)
    if (next.has(role)) next.delete(role)
    else next.add(role)
    set({ expandedRoles: next })
  },

  toggleCostBar: () => set({ costBarExpanded: !get().costBarExpanded }),
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // ── Real-time ───────────────────────────────────────────────────────────

  subscribeToChanges: () => {
    const { venueId } = get()
    if (!venueId) return () => {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase realtime channel API
    const channel = (supabase as any)
      .channel(`roster_${venueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'roster_shifts',
        filter: `venue_id=eq.${venueId}`,
      }, () => {
        get().loadWeek(get().selectedDate)
      })
      .subscribe()

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase realtime cleanup
      ;(supabase as any).removeChannel(channel)
    }
  },
}))
