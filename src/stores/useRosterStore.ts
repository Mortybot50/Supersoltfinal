/**
 * Dedicated Zustand store for the new roster redesign.
 * Handles all roster state, Supabase operations, and real-time subscriptions.
 * Does NOT use the monolith dataStore — roster data lives here only.
 */

import { create } from 'zustand'
import { RosterShift, Staff, StaffAvailability, ShiftTemplate, RosterPattern, TemplateShiftDef } from '@/types'
import type { PendingShiftInfo } from '@/components/roster/ShiftCreateDialog'
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
  addShiftTemplateToDB,
  loadRosterPatternsFromDB,
  addRosterPatternToDB,
  updateRosterPatternInDB,
  deleteRosterPatternFromDB,
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
  // Normalize timestamptz to HH:MM
  if (startTime.includes('T')) {
    const d = new Date(startTime)
    if (!isNaN(d.getTime())) startTime = `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
  }
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
  pendingShift: PendingShiftInfo | null

  // Clipboard
  copiedShift: RosterShift | null

  // Toolbar state
  spotlightFilter: string | null
  groupBy: 'none' | 'role' | 'employment_type'
  viewMode: 'staff' | 'compact' | 'stats'

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
  setPendingShift: (shift: PendingShiftInfo | null) => void

  // Clipboard
  setCopiedShift: (shift: RosterShift | null) => void

  // Toolbar
  setSpotlightFilter: (filter: string | null) => void
  setGroupBy: (groupBy: 'none' | 'role' | 'employment_type') => void
  setViewMode: (viewMode: 'staff' | 'compact' | 'stats') => void

  // Quick Build
  quickBuildOpen: boolean
  rosterPatterns: RosterPattern[]
  toggleQuickBuild: () => void
  setQuickBuildOpen: (open: boolean) => void
  copyWeekShifts: (sourceWeekStart: Date) => Promise<{ created: number; conflicts: number }>
  copyDayShifts: (sourceDate: Date, targetDates: Date[]) => Promise<{ created: number; conflicts: number }>
  autoFill: (mode: 'copy_last' | 'assign_open' | 'build_empty') => Promise<void>
  saveCurrentAsTemplate: (name: string) => Promise<boolean>
  applyRosterTemplate: (template: ShiftTemplate) => Promise<{ created: number; conflicts: number }>
  addRosterPattern: (pattern: Omit<RosterPattern, 'id' | 'created_at' | 'updated_at'>) => Promise<boolean>
  updateRosterPattern: (id: string, updates: Partial<Pick<RosterPattern, 'name' | 'description' | 'shifts'>>) => Promise<boolean>
  deleteRosterPattern: (id: string) => Promise<boolean>
  applyRosterPattern: (patternId: string) => Promise<{ created: number; conflicts: number }>

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
    start_time: normalizeTime(row.start_time),
    end_time: normalizeTime(row.end_time),
    break_minutes: row.break_duration_mins ?? row.break_minutes ?? 0,
    role: row.position || row.role || 'crew',
    notes: row.notes,
    status: row.status === 'draft' ? 'scheduled' : row.status === 'published' ? 'confirmed' : (row.status || 'scheduled'),
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

function normalizeTime(t: string): string {
  if (!t) return '00:00'
  if (t.includes('T')) {
    const d = new Date(t)
    if (isNaN(d.getTime())) return '00:00'
    return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`
  }
  return t
}

function calcHours(start: string, end: string, breakMins: number): number {
  start = normalizeTime(start)
  end = normalizeTime(end)
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
  sidebarOpen: true,
  pendingShift: null,
  copiedShift: null,
  spotlightFilter: null,
  groupBy: 'role',
  viewMode: 'staff',
  quickBuildOpen: false,
  rosterPatterns: [],

  // ── Bootstrap ──────────────────────────────────────────────────────────

  init: async (venueId, orgId) => {
    // Guard: don't re-init if already set to same venue
    if (get().venueId === venueId && get().staff.length > 0) return

    set({ venueId, orgId })

    try {
      const [staff, templates, availability, rosterPatterns] = await Promise.all([
        loadStaffFromDB(),
        loadShiftTemplatesFromDB(venueId),
        loadStaffAvailabilityFromDB(),
        loadRosterPatternsFromDB(venueId),
      ])

      // Default all roles expanded
      const roles = [...new Set(staff.map(s => s.role))]
      const expandedRoles = new Set<string>(roles)

      set({ staff, templates, availability, expandedRoles, rosterPatterns })
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
    if (view === 'day') {
      const next = addDays(selectedDate, direction)
      set({ selectedDate: next, selectedDayIndex: next.getDay() === 0 ? 6 : next.getDay() - 1 })
      get().loadWeek(getWeekStart(next))
      return
    }
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

    const id = crypto.randomUUID()
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
  setPendingShift: (shift) => set({ pendingShift: shift }),
  setCopiedShift: (shift) => set({ copiedShift: shift }),
  setSpotlightFilter: (filter) => set({ spotlightFilter: filter }),
  setGroupBy: (groupBy) => set({ groupBy }),
  setViewMode: (viewMode) => set({ viewMode }),

  // ── Quick Build ─────────────────────────────────────────────────────────

  toggleQuickBuild: () => set({ quickBuildOpen: !get().quickBuildOpen }),
  setQuickBuildOpen: (open) => set({ quickBuildOpen: open }),

  copyWeekShifts: async (sourceWeekStart) => {
    const { venueId, orgId, shifts: currentShifts, selectedDate, addShift } = get()
    if (!venueId || !orgId) return { created: 0, conflicts: 0 }

    const sourceEnd = addDays(sourceWeekStart, 6)
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data } = await (supabase as any)
      .from('roster_shifts')
      .select('*')
      .eq('venue_id', venueId)
      .gte('shift_date', format(sourceWeekStart, 'yyyy-MM-dd'))
      .lte('shift_date', format(sourceEnd, 'yyyy-MM-dd'))
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (!data || data.length === 0) return { created: 0, conflicts: 0 }

    let created = 0
    let conflicts = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of data as any[]) {
      const sourceDate = new Date(row.shift_date as string)
      const dayOffset = sourceDate.getDay() === 0 ? 6 : sourceDate.getDay() - 1
      const targetDate = addDays(selectedDate, dayOffset)

      const conflict = currentShifts.some(s => {
        const d = s.date instanceof Date ? s.date : new Date(s.date)
        return s.staff_id === row.staff_id &&
          d.toDateString() === targetDate.toDateString() &&
          s.status !== 'cancelled'
      })
      if (conflict) { conflicts++; continue }

      await addShift({
        venue_id: venueId,
        staff_id: row.staff_id || '',
        date: targetDate,
        start_time: normalizeTime(row.start_time),
        end_time: normalizeTime(row.end_time),
        break_minutes: row.break_duration_mins ?? row.break_minutes ?? 0,
        role: row.position || row.role || 'crew',
        status: 'scheduled',
        is_open_shift: row.is_open_shift || false,
      })
      created++
    }
    return { created, conflicts }
  },

  copyDayShifts: async (sourceDate, targetDates) => {
    const { venueId, orgId, shifts: currentShifts, addShift } = get()
    if (!venueId || !orgId || targetDates.length === 0) return { created: 0, conflicts: 0 }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const { data } = await (supabase as any)
      .from('roster_shifts')
      .select('*')
      .eq('venue_id', venueId)
      .eq('shift_date', format(sourceDate, 'yyyy-MM-dd'))
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (!data || data.length === 0) return { created: 0, conflicts: 0 }

    let created = 0
    let conflicts = 0
    for (const targetDate of targetDates) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of data as any[]) {
        const conflict = currentShifts.some(s => {
          const d = s.date instanceof Date ? s.date : new Date(s.date)
          return s.staff_id === row.staff_id &&
            d.toDateString() === targetDate.toDateString() &&
            s.status !== 'cancelled'
        })
        if (conflict) { conflicts++; continue }

        await addShift({
          venue_id: venueId,
          staff_id: row.staff_id || '',
          date: targetDate,
          start_time: normalizeTime(row.start_time),
          end_time: normalizeTime(row.end_time),
          break_minutes: row.break_duration_mins ?? row.break_minutes ?? 0,
          role: row.position || row.role || 'crew',
          status: 'scheduled',
          is_open_shift: row.is_open_shift || false,
        })
        created++
      }
    }
    return { created, conflicts }
  },

  autoFill: async (mode) => {
    const { ghostShifts, shifts, staff, availability, selectedDate, addShift, updateShift } = get()
    const weekEnd = addDays(selectedDate, 6)

    if (mode === 'copy_last') {
      let created = 0
      for (const ghost of ghostShifts) {
        const ghostDate = ghost.date instanceof Date ? ghost.date : new Date(ghost.date)
        const dayOffset = ghostDate.getDay() === 0 ? 6 : ghostDate.getDay() - 1
        const targetDate = addDays(selectedDate, dayOffset)
        if (targetDate > weekEnd) continue

        const alreadyScheduled = shifts.some(s => {
          const d = s.date instanceof Date ? s.date : new Date(s.date)
          return s.staff_id === ghost.staff_id &&
            d.toDateString() === targetDate.toDateString() &&
            s.status !== 'cancelled'
        })
        if (alreadyScheduled) continue

        const member = staff.find(s => s.id === ghost.staff_id)
        if (!member || member.status !== 'active') continue

        const dayOfWeek = targetDate.getDay()
        const isUnavailable = availability.some(a =>
          a.staff_id === ghost.staff_id &&
          a.type === 'unavailable' &&
          a.is_recurring &&
          a.day_of_week === dayOfWeek
        )
        if (isUnavailable) continue

        await addShift({ ...ghost, date: targetDate, status: 'scheduled' })
        created++
      }
      toast.success(`Auto-filled ${created} shift${created !== 1 ? 's' : ''} from last week`)
      return
    }

    if (mode === 'assign_open') {
      const openInWeek = shifts.filter(s => {
        if (s.staff_id) return false
        const d = s.date instanceof Date ? s.date : new Date(s.date)
        return d >= selectedDate && d <= weekEnd
      })

      const staffHours: Record<string, number> = {}
      for (const s of shifts) {
        if (s.staff_id && s.status !== 'cancelled') {
          staffHours[s.staff_id] = (staffHours[s.staff_id] || 0) + (s.total_hours || 0)
        }
      }

      let assigned = 0
      for (const openShift of openInWeek) {
        const shiftDate = openShift.date instanceof Date ? openShift.date : new Date(openShift.date)
        const dayOfWeek = shiftDate.getDay()

        const eligible = staff.filter(member => {
          if (member.status !== 'active') return false
          if (openShift.role && member.role !== openShift.role) return false
          const isUnavailable = availability.some(a =>
            a.staff_id === member.id &&
            a.type === 'unavailable' &&
            a.is_recurring &&
            a.day_of_week === dayOfWeek
          )
          if (isUnavailable) return false
          const alreadyScheduled = shifts.some(s => {
            const d = s.date instanceof Date ? s.date : new Date(s.date)
            return s.staff_id === member.id &&
              d.toDateString() === shiftDate.toDateString() &&
              s.status !== 'cancelled'
          })
          return !alreadyScheduled
        })

        if (eligible.length === 0) continue

        const ranked = [...eligible].sort((a, b) => {
          const aLast = ghostShifts.some(g => {
            const gDate = g.date instanceof Date ? g.date : new Date(g.date)
            return g.staff_id === a.id && gDate.getDay() === dayOfWeek && g.start_time === openShift.start_time
          })
          const bLast = ghostShifts.some(g => {
            const gDate = g.date instanceof Date ? g.date : new Date(g.date)
            return g.staff_id === b.id && gDate.getDay() === dayOfWeek && g.start_time === openShift.start_time
          })
          if (aLast && !bLast) return -1
          if (bLast && !aLast) return 1
          return (staffHours[a.id] || 0) - (staffHours[b.id] || 0)
        })

        const best = ranked[0]
        await updateShift(openShift.id, { staff_id: best.id, staff_name: best.name, is_open_shift: false })
        staffHours[best.id] = (staffHours[best.id] || 0) + (openShift.total_hours || 0)
        assigned++
      }

      if (assigned === 0) {
        toast.info('No open shifts could be assigned — check staff availability and roles')
      } else {
        toast.success(`Assigned ${assigned} open shift${assigned !== 1 ? 's' : ''}`)
      }
      return
    }

    if (mode === 'build_empty') {
      toast.info('Build Empty Roster requires demand data. Set up sales forecasting first.')
    }
  },

  saveCurrentAsTemplate: async (name) => {
    const { venueId, orgId, shifts, selectedDate, templates } = get()
    if (!venueId || !orgId || !name.trim()) return false

    const weekEnd = addDays(selectedDate, 6)
    const weekShifts = shifts.filter(s => {
      const d = s.date instanceof Date ? s.date : new Date(s.date)
      return d >= selectedDate && d <= weekEnd && s.status !== 'cancelled'
    })

    if (weekShifts.length === 0) {
      toast.error('No shifts in the current week to save as template')
      return false
    }

    const templateShifts: TemplateShiftDef[] = weekShifts.map(s => {
      const d = s.date instanceof Date ? s.date : new Date(s.date)
      return {
        day_of_week: d.getDay(),
        start_time: s.start_time,
        end_time: s.end_time,
        break_minutes: s.break_minutes,
        role: s.role,
        staff_id: s.staff_id || null,
      }
    })

    const firstShift = weekShifts[0]
    const newTemplate: ShiftTemplate = {
      id: crypto.randomUUID(),
      organization_id: orgId,
      venue_id: venueId,
      name: name.trim(),
      start_time: firstShift.start_time,
      end_time: firstShift.end_time,
      break_minutes: firstShift.break_minutes,
      role: (firstShift.role as 'manager' | 'supervisor' | 'crew') || 'crew',
      days_of_week: [...new Set(templateShifts.map(s => s.day_of_week))],
      template_shifts: templateShifts,
      usage_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const saved = await addShiftTemplateToDB(newTemplate)
    if (saved) {
      set({ templates: [...templates, saved] })
      toast.success(`Template "${name}" saved with ${weekShifts.length} shifts`)
      return true
    }
    return false
  },

  applyRosterTemplate: async (template) => {
    const { venueId, orgId, shifts: currentShifts, selectedDate, addShift } = get()
    if (!venueId || !orgId) return { created: 0, conflicts: 0 }

    const weekEnd = addDays(selectedDate, 6)
    const templateShifts: TemplateShiftDef[] =
      template.template_shifts && template.template_shifts.length > 0
        ? template.template_shifts
        : template.days_of_week.map(dow => ({
            day_of_week: dow,
            start_time: template.start_time,
            end_time: template.end_time,
            break_minutes: template.break_minutes,
            role: template.role,
            staff_id: null,
          }))

    let created = 0
    let conflicts = 0
    for (const tShift of templateShifts) {
      const offset = tShift.day_of_week === 0 ? 6 : tShift.day_of_week - 1
      const targetDate = addDays(selectedDate, offset)
      if (targetDate > weekEnd) continue

      const conflict = currentShifts.some(s => {
        const d = s.date instanceof Date ? s.date : new Date(s.date)
        if (d.toDateString() !== targetDate.toDateString()) return false
        if (tShift.staff_id && s.staff_id !== tShift.staff_id) return false
        const [sh, sm] = tShift.start_time.split(':').map(Number)
        const [eh, em] = tShift.end_time.split(':').map(Number)
        const [ssh, ssm] = s.start_time.split(':').map(Number)
        const [seh, sem] = s.end_time.split(':').map(Number)
        return (sh * 60 + sm) < (seh * 60 + sem) && (eh * 60 + em) > (ssh * 60 + ssm)
      })
      if (conflict) { conflicts++; continue }

      await addShift({
        venue_id: venueId,
        staff_id: tShift.staff_id || '',
        date: targetDate,
        start_time: tShift.start_time,
        end_time: tShift.end_time,
        break_minutes: tShift.break_minutes,
        role: tShift.role,
        status: 'scheduled',
        is_open_shift: !tShift.staff_id,
        template_id: template.id,
      })
      created++
    }
    return { created, conflicts }
  },

  addRosterPattern: async (pattern) => {
    const { orgId, rosterPatterns } = get()
    if (!orgId) return false
    const saved = await addRosterPatternToDB(pattern, orgId)
    if (saved) {
      set({ rosterPatterns: [...rosterPatterns, saved] })
      return true
    }
    return false
  },

  updateRosterPattern: async (id, updates) => {
    const ok = await updateRosterPatternInDB(id, updates)
    if (ok) {
      set({
        rosterPatterns: get().rosterPatterns.map(p =>
          p.id === id ? { ...p, ...updates, updated_at: new Date() } : p
        ),
      })
    }
    return ok
  },

  deleteRosterPattern: async (id) => {
    const ok = await deleteRosterPatternFromDB(id)
    if (ok) {
      set({ rosterPatterns: get().rosterPatterns.filter(p => p.id !== id) })
    }
    return ok
  },

  applyRosterPattern: async (patternId) => {
    const { rosterPatterns, venueId, orgId, shifts: currentShifts, selectedDate, addShift } = get()
    const pattern = rosterPatterns.find(p => p.id === patternId)
    if (!pattern || !venueId || !orgId) return { created: 0, conflicts: 0 }

    const weekEnd = addDays(selectedDate, 6)
    let created = 0
    let conflicts = 0

    for (const tShift of pattern.shifts) {
      const offset = tShift.day_of_week === 0 ? 6 : tShift.day_of_week - 1
      const targetDate = addDays(selectedDate, offset)
      if (targetDate > weekEnd) continue

      const conflict = currentShifts.some(s => {
        const d = s.date instanceof Date ? s.date : new Date(s.date)
        if (d.toDateString() !== targetDate.toDateString()) return false
        if (tShift.staff_id && s.staff_id !== tShift.staff_id) return false
        const [sh, sm] = tShift.start_time.split(':').map(Number)
        const [eh, em] = tShift.end_time.split(':').map(Number)
        const [ssh, ssm] = s.start_time.split(':').map(Number)
        const [seh, sem] = s.end_time.split(':').map(Number)
        return (sh * 60 + sm) < (seh * 60 + sem) && (eh * 60 + em) > (ssh * 60 + ssm)
      })
      if (conflict) { conflicts++; continue }

      await addShift({
        venue_id: venueId,
        staff_id: tShift.staff_id || '',
        date: targetDate,
        start_time: tShift.start_time,
        end_time: tShift.end_time,
        break_minutes: tShift.break_minutes,
        role: tShift.role,
        status: 'scheduled',
        is_open_shift: !tShift.staff_id,
      })
      created++
    }
    return { created, conflicts }
  },

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
