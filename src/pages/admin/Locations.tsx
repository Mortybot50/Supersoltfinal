import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageShell, PageToolbar, EmptyState } from '@/components/shared'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Plus,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Search,
  Warehouse,
  Thermometer,
  Calendar,
  ExternalLink,
  GripVertical,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

type LocationType = 'Storeroom' | 'LineStation' | 'Fridge' | 'Freezer' | 'ReceivingBay' | 'PrepArea' | 'Bar' | 'Other'
type CountingMethod = 'Each' | 'WeightKg' | 'VolumeL' | 'Mixed'
type UOM = 'each' | 'g' | 'kg' | 'ml' | 'L'
type DeviceType = 'Probe' | 'FridgeSensor' | 'FreezerSensor' | 'Scale' | 'Other'
type Frequency = 'Daily' | 'Weekly' | 'Fortnightly' | 'Monthly' | 'Custom'

interface Location {
  id: string
  venue_id: string
  name: string
  code: string | null
  type: LocationType
  temperature_target_c: number | null
  counting_method: CountingMethod
  default_uom: UOM | null
  capacity_hint: string | null
  is_active: boolean
  display_order: number
}

interface Bin {
  id: string
  location_id: string
  name: string
  barcode: string | null
}

interface Assignment {
  id: string
  ingredient_id: string
  location_id: string
  bin_id: string | null
  count_uom: UOM
  par_level: number | null
  min_level: number | null
  max_level: number | null
  ingredient_name?: string
  bin_name?: string
}

interface Device {
  id: string
  location_id: string
  device_type: DeviceType
  device_id: string
}

interface CountSchedule {
  id: string
  venue_id: string
  schedule_name: string
  frequency: Frequency
  days_of_week: number[]
  location_ids: string[]
  due_time_local: string | null
}

export default function Locations() {
  const { currentVenue } = useAuth()
  const [locations, setLocations] = useState<Location[]>([])
  const [schedules, setSchedules] = useState<CountSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  
  // Location Editor State
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [locationForm, setLocationForm] = useState<Partial<Location>>({
    name: '',
    code: null,
    type: 'Storeroom',
    counting_method: 'Mixed',
    is_active: true,
    display_order: 0,
  })
  
  // Bins, Assignments, Devices state
  const [bins, setBins] = useState<Bin[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [newBinName, setNewBinName] = useState('')
  const [newBinBarcode, setNewBinBarcode] = useState('')
  const [showBinForm, setShowBinForm] = useState(false)
  
  // Schedule Editor State
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<CountSchedule | null>(null)
  const [scheduleForm, setScheduleForm] = useState<Partial<CountSchedule>>({
    schedule_name: '',
    frequency: 'Weekly',
    days_of_week: [],
    location_ids: [],
  })

  const currentVenueId = currentVenue?.id || ''

  useEffect(() => {
    if (!currentVenueId) return
    loadLocations()
    loadSchedules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVenueId]) // loadLocations/loadSchedules are local functions

  const loadLocations = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inv_locations')
        .select('*')
        .eq('venue_id', currentVenueId)
        .order('display_order', { ascending: true })

      if (error) throw error
      setLocations((data || []) as Location[])
    } catch (error) {
      console.error('Error loading locations:', error)
      toast.error('Error', { description: 'Failed to load locations',
        variant: 'destructive', })
    } finally {
      setLoading(false)
    }
  }

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('count_schedules')
        .select('*')
        .eq('venue_id', currentVenueId)

      if (error) throw error
      setSchedules((data || []) as CountSchedule[])
    } catch (error) {
      console.error('Error loading schedules:', error)
    }
  }

  const loadBins = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('inv_bins')
        .select('*')
        .eq('location_id', locationId)

      if (error) throw error
      setBins((data || []) as Bin[])
    } catch (error) {
      console.error('Error loading bins:', error)
    }
  }

  const loadAssignments = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('inv_location_assignments')
        .select(`
          *,
          ingredients (name)
        `)
        .eq('location_id', locationId)

      if (error) throw error
      const mapped = (data || []).map((a: Assignment & { ingredients?: { name: string } }) => ({
        ...a,
        ingredient_name: a.ingredients?.name || 'Unknown',
      }))
      setAssignments(mapped)
    } catch (error) {
      console.error('Error loading assignments:', error)
    }
  }

  const loadDevices = async (locationId: string) => {
    try {
      const { data, error } = await supabase
        .from('device_assignments')
        .select('*')
        .eq('location_id', locationId)

      if (error) throw error
      setDevices((data || []) as Device[])
    } catch (error) {
      console.error('Error loading devices:', error)
    }
  }

  const handleOpenLocationDialog = (location?: Location) => {
    if (location) {
      setEditingLocation(location)
      setLocationForm(location)
      loadBins(location.id)
      loadAssignments(location.id)
      loadDevices(location.id)
    } else {
      setEditingLocation(null)
      setLocationForm({
        name: '',
        code: null,
        type: 'Storeroom',
        counting_method: 'Mixed',
        is_active: true,
        display_order: locations.length,
      })
      setBins([])
      setAssignments([])
      setDevices([])
    }
    setLocationDialogOpen(true)
  }

  const handleSaveLocation = async () => {
    try {
      // Validation
      if (!locationForm.name || locationForm.name.trim() === '') {
        toast.error('Validation Error', { description: 'Name is required',
          variant: 'destructive', })
        return
      }

      if (!locationForm.type) {
        toast.error('Validation Error', { description: 'Type is required',
          variant: 'destructive', })
        return
      }

      if ((locationForm.type === 'Fridge' || locationForm.type === 'Freezer') && !locationForm.temperature_target_c) {
        toast.error('Validation Error', { description: 'Temperature target (°C) is required for fridges and freezers',
          variant: 'destructive', })
        return
      }

      const payload: Partial<Location> & { venue_id: string } = {
        ...locationForm,
        venue_id: currentVenueId,
        name: locationForm.name || '',
        type: locationForm.type || 'Other',
      }

      if (editingLocation) {
        const { error } = await supabase
          .from('inv_locations')
          .update(payload)
          .eq('id', editingLocation.id)

        if (error) throw error
        toast.success('Success', { description: 'Location updated' })
      } else {
        const { error } = await supabase
          .from('inv_locations')
          .insert([payload])

        if (error) throw error
        toast.success('Success', { description: 'Location created' })
      }

      setLocationDialogOpen(false)
      loadLocations()
    } catch (error) {
      console.error('Error saving location:', error)
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to save location',
        variant: 'destructive', })
    }
  }

  const handleDuplicateLocation = async (location: Location) => {
    try {
      const newLocation = {
        ...location,
        id: undefined,
        name: `${location.name} Copy`,
        code: null, // Clear code to avoid uniqueness conflict
      }

      const { data, error } = await supabase
        .from('inv_locations')
        .insert([newLocation])
        .select()
        .single()

      if (error) throw error

      // Duplicate bins (but not assignments)
      if (data) {
        const { data: originalBins } = await supabase
          .from('inv_bins')
          .select('*')
          .eq('location_id', location.id)

        if (originalBins && originalBins.length > 0) {
          const newBins = originalBins.map((bin) => ({
            location_id: data.id,
            name: bin.name,
            barcode: null, // Clear barcode to avoid uniqueness conflict
          }))

          await supabase.from('inv_bins').insert(newBins)
        }
      }

      toast.success('Success', { description: 'Location duplicated' })
      loadLocations()
    } catch (error) {
      console.error('Error duplicating location:', error)
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to duplicate location',
        variant: 'destructive', })
    }
  }

  const handleToggleActive = async (location: Location) => {
    try {
      const { error } = await supabase
        .from('inv_locations')
        .update({ is_active: !location.is_active })
        .eq('id', location.id)

      if (error) throw error
      toast.success('Success', { description: location.is_active ? 'Location deactivated' : 'Location activated', })
      loadLocations()
    } catch (error) {
      console.error('Error toggling location:', error)
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to update location',
        variant: 'destructive', })
    }
  }

  const handleDeleteLocation = async (location: Location) => {
    try {
      // Check if location has bins or assignments
      const { data: binsData } = await supabase
        .from('inv_bins')
        .select('id')
        .eq('location_id', location.id)

      const { data: assignmentsData } = await supabase
        .from('inv_location_assignments')
        .select('id')
        .eq('location_id', location.id)

      if ((binsData && binsData.length > 0) || (assignmentsData && assignmentsData.length > 0)) {
        toast.error('Cannot Delete', { description: 'This location has bins or assignments. Remove them first.',
          variant: 'destructive', })
        return
      }

      if (!confirm(`Permanently delete ${location.name}?`)) return

      const { error } = await supabase
        .from('inv_locations')
        .delete()
        .eq('id', location.id)

      if (error) throw error
      toast.success('Success', { description: 'Location deleted' })
      loadLocations()
    } catch (error) {
      console.error('Error deleting location:', error)
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to delete location',
        variant: 'destructive', })
    }
  }

  const handleAddBin = async () => {
    if (!editingLocation) return
    if (!newBinName.trim()) {
      toast.error('Validation Error', { description: 'Bin name is required' })
      return
    }

    try {
      const { error } = await supabase
        .from('inv_bins')
        .insert([{
          location_id: editingLocation.id,
          name: newBinName,
          barcode: newBinBarcode || null,
        }])

      if (error) throw error
      toast.success('Success', { description: 'Bin added' })
      setNewBinName('')
      setNewBinBarcode('')
      setShowBinForm(false)
      loadBins(editingLocation.id)
    } catch (error) {
      console.error('Error adding bin:', error)
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to add bin',
        variant: 'destructive', })
    }
  }

  const handleDeleteBin = async (binId: string) => {
    if (!confirm('Delete this bin?')) return

    try {
      const { error } = await supabase
        .from('inv_bins')
        .delete()
        .eq('id', binId)

      if (error) throw error
      toast.success('Success', { description: 'Bin deleted' })
      if (editingLocation) loadBins(editingLocation.id)
    } catch (error) {
      console.error('Error deleting bin:', error)
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to delete bin',
        variant: 'destructive', })
    }
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Remove this assignment?')) return

    try {
      const { error } = await supabase
        .from('inv_location_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error
      toast.success('Success', { description: 'Assignment removed' })
      if (editingLocation) loadAssignments(editingLocation.id)
    } catch (error) {
      console.error('Error deleting assignment:', error)
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to remove assignment',
        variant: 'destructive', })
    }
  }

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Remove this device?')) return

    try {
      const { error } = await supabase
        .from('device_assignments')
        .delete()
        .eq('id', deviceId)

      if (error) throw error
      toast.success('Success', { description: 'Device removed' })
      if (editingLocation) loadDevices(editingLocation.id)
    } catch (error) {
      console.error('Error deleting device:', error)
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to remove device',
        variant: 'destructive', })
    }
  }

  const handleSaveSchedule = async () => {
    try {
      if (!scheduleForm.schedule_name || scheduleForm.schedule_name.trim() === '') {
        toast.error('Validation Error', { description: 'Schedule name is required' })
        return
      }

      if (!scheduleForm.frequency) {
        toast.error('Validation Error', { description: 'Frequency is required' })
        return
      }

      if (!scheduleForm.location_ids || scheduleForm.location_ids.length === 0) {
        toast.error('Validation Error', { description: 'Select at least one location' })
        return
      }

      const payload: Partial<Schedule> & { venue_id: string } = {
        ...scheduleForm,
        venue_id: currentVenueId,
        schedule_name: scheduleForm.schedule_name || '',
        frequency: scheduleForm.frequency || 'Weekly',
      }

      if (editingSchedule) {
        const { error } = await supabase
          .from('count_schedules')
          .update(payload)
          .eq('id', editingSchedule.id)

        if (error) throw error
        toast.success('Success', { description: 'Schedule updated' })
      } else {
        const { error } = await supabase
          .from('count_schedules')
          .insert([payload])

        if (error) throw error
        toast.success('Success', { description: 'Schedule created' })
      }

      setScheduleDialogOpen(false)
      loadSchedules()
    } catch (error) {
      console.error('Error saving schedule:', error)
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to save schedule',
        variant: 'destructive', })
    }
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Delete this schedule?')) return

    try {
      const { error } = await supabase
        .from('count_schedules')
        .delete()
        .eq('id', scheduleId)

      if (error) throw error
      toast.success('Success', { description: 'Schedule deleted' })
      loadSchedules()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to delete schedule',
        variant: 'destructive', })
    }
  }

  const filteredLocations = locations.filter((loc) => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (loc.code && loc.code.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesType = typeFilter === 'All' || loc.type === typeFilter
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? loc.is_active : true)
    return matchesSearch && matchesType && matchesStatus
  })

  const stats = {
    total: locations.length,
    active: locations.filter((l) => l.is_active).length,
    coldStorage: locations.filter((l) => l.type === 'Fridge' || l.type === 'Freezer').length,
    scheduledCounts: schedules.length,
  }

  const toolbar = (
    <PageToolbar
      title="Locations"
      primaryAction={{
        label: 'Add Location',
        icon: Plus,
        onClick: () => handleOpenLocationDialog(),
        variant: 'primary',
      }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-4 md:p-6 space-y-6">

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cold Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.coldStorage}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled Counts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduledCounts}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Locations List (spans 2 columns) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Locations</CardTitle>
            <div className="flex gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Types</SelectItem>
                  <SelectItem value="Storeroom">Storeroom</SelectItem>
                  <SelectItem value="Fridge">Fridge</SelectItem>
                  <SelectItem value="Freezer">Freezer</SelectItem>
                  <SelectItem value="LineStation">Line Station</SelectItem>
                  <SelectItem value="Bar">Bar</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredLocations.length === 0 ? (
              <EmptyState
                icon={Warehouse}
                title="No locations yet"
                description="Add your first storage area to get started."
                action={{ label: "Add Location", onClick: () => handleOpenLocationDialog(), icon: Plus }}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Temp (°C)</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocations.map((location) => (
                    <TableRow key={location.id} className="hover:bg-accent/50">
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </TableCell>
                      <TableCell className="font-medium">{location.name}</TableCell>
                      <TableCell>{location.code || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{location.type}</Badge>
                      </TableCell>
                      <TableCell>{location.default_uom || '-'}</TableCell>
                      <TableCell>{location.counting_method}</TableCell>
                      <TableCell>
                        {location.temperature_target_c ? (
                          <span className="flex items-center gap-1">
                            <Thermometer className="h-4 w-4 text-blue-500" />
                            {location.temperature_target_c}°C
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {location.is_active ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="More actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenLocationDialog(location)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateLocation(location)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(location)}>
                              {location.is_active ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteLocation(location)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Count Schedules */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Count Schedules</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingSchedule(null)
                    setScheduleForm({
                      schedule_name: '',
                      frequency: 'Weekly',
                      days_of_week: [],
                      location_ids: [],
                    })
                    setScheduleDialogOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {schedules.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Calendar className="mx-auto h-8 w-8 opacity-50 mb-2" />
                  No schedules yet
                </div>
              ) : (
                <div className="space-y-2">
                  {schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{schedule.schedule_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {schedule.frequency} • {schedule.location_ids.length} locations
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingSchedule(schedule)
                            setScheduleForm(schedule)
                            setScheduleDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reference Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="/admin/venue-settings">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Venue Settings
                </a>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                POS, printers, suppliers, and other venue settings are managed in Venue Settings.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Location Editor Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
            <DialogDescription>
              Configure storage area details, bins, assignments, and devices.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="bins">Bins</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="devices">Devices</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="name">Location Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Walk-in Fridge, Dry Store"
                    value={locationForm.name}
                    onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g., WIF-01"
                    value={locationForm.code || ''}
                    onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value || null })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used for barcode labels</p>
                </div>

                <div>
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={locationForm.type}
                    onValueChange={(value) => setLocationForm({ ...locationForm, type: value as LocationType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Storeroom">Storeroom</SelectItem>
                      <SelectItem value="LineStation">Line Station</SelectItem>
                      <SelectItem value="Fridge">Fridge</SelectItem>
                      <SelectItem value="Freezer">Freezer</SelectItem>
                      <SelectItem value="ReceivingBay">Receiving Bay</SelectItem>
                      <SelectItem value="PrepArea">Prep Area</SelectItem>
                      <SelectItem value="Bar">Bar</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="counting_method">Counting Method</Label>
                  <Select
                    value={locationForm.counting_method}
                    onValueChange={(value) =>
                      setLocationForm({ ...locationForm, counting_method: value as CountingMethod })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Each">Each</SelectItem>
                      <SelectItem value="WeightKg">Weight (kg)</SelectItem>
                      <SelectItem value="VolumeL">Volume (L)</SelectItem>
                      <SelectItem value="Mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {locationForm.counting_method !== 'Mixed' && (
                  <div>
                    <Label htmlFor="default_uom">Default UOM</Label>
                    <Select
                      value={locationForm.default_uom || ''}
                      onValueChange={(value) => setLocationForm({ ...locationForm, default_uom: value as UOM })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="each">Each</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(locationForm.type === 'Fridge' || locationForm.type === 'Freezer') && (
                  <div>
                    <Label htmlFor="temperature">Temperature Target (°C) *</Label>
                    <Input
                      id="temperature"
                      type="number"
                      placeholder="e.g., 4"
                      value={locationForm.temperature_target_c || ''}
                      onChange={(e) =>
                        setLocationForm({
                          ...locationForm,
                          temperature_target_c: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="capacity">Capacity Hint</Label>
                  <Input
                    id="capacity"
                    placeholder="e.g., 10 trays, 200kg max"
                    value={locationForm.capacity_hint || ''}
                    onChange={(e) =>
                      setLocationForm({ ...locationForm, capacity_hint: e.target.value || null })
                    }
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={locationForm.is_active}
                    onCheckedChange={(checked) => setLocationForm({ ...locationForm, is_active: checked })}
                  />
                  <Label htmlFor="active">Active</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bins" className="space-y-4 mt-4">
              {!editingLocation ? (
                <p className="text-sm text-muted-foreground">Save the location first to add bins.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Barcode</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bins.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No bins yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        bins.map((bin) => (
                          <TableRow key={bin.id}>
                            <TableCell>{bin.name}</TableCell>
                            <TableCell>{bin.barcode || '-'}</TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteBin(bin.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>

                  {showBinForm ? (
                    <div className="border rounded-lg p-4 space-y-4">
                      <div>
                        <Label htmlFor="bin_name">Bin Name *</Label>
                        <Input
                          id="bin_name"
                          placeholder="e.g., Top Shelf Left"
                          value={newBinName}
                          onChange={(e) => setNewBinName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="bin_barcode">Barcode</Label>
                        <Input
                          id="bin_barcode"
                          placeholder="Optional"
                          value={newBinBarcode}
                          onChange={(e) => setNewBinBarcode(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddBin}>Save</Button>
                        <Button variant="outline" onClick={() => setShowBinForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={() => setShowBinForm(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Bin
                    </Button>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="assignments" className="space-y-4 mt-4">
              {!editingLocation ? (
                <p className="text-sm text-muted-foreground">Save the location first to add assignments.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Bin</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead>Par</TableHead>
                        <TableHead>Min</TableHead>
                        <TableHead>Max</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No assignments yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        assignments.map((assignment) => (
                          <TableRow key={assignment.id}>
                            <TableCell>{assignment.ingredient_name}</TableCell>
                            <TableCell>{assignment.bin_name || '-'}</TableCell>
                            <TableCell>{assignment.count_uom}</TableCell>
                            <TableCell>{assignment.par_level || '-'}</TableCell>
                            <TableCell>{assignment.min_level || '-'}</TableCell>
                            <TableCell>{assignment.max_level || '-'}</TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteAssignment(assignment.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <p className="text-sm text-muted-foreground">
                    Assign ingredients to this location from the Ingredients page.
                  </p>
                </>
              )}
            </TabsContent>

            <TabsContent value="devices" className="space-y-4 mt-4">
              {!editingLocation ? (
                <p className="text-sm text-muted-foreground">Save the location first to add devices.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Device Type</TableHead>
                        <TableHead>Device ID</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No devices yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        devices.map((device) => (
                          <TableRow key={device.id}>
                            <TableCell>{device.device_type}</TableCell>
                            <TableCell>{device.device_id}</TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteDevice(device.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <p className="text-sm text-muted-foreground">Device assignment UI coming soon.</p>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            {editingLocation && (
              <Button
                variant="destructive"
                onClick={() => {
                  handleDeleteLocation(editingLocation)
                  setLocationDialogOpen(false)
                }}
              >
                Delete Location
              </Button>
            )}
            <Button variant="outline" onClick={() => setLocationDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLocation}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Editor Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'New Schedule'}</DialogTitle>
            <DialogDescription>Configure count schedule details and locations.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="schedule_name">Schedule Name *</Label>
              <Input
                id="schedule_name"
                placeholder="e.g., Weekly Dry Goods Count"
                value={scheduleForm.schedule_name}
                onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="frequency">Frequency *</Label>
              <Select
                value={scheduleForm.frequency}
                onValueChange={(value) => setScheduleForm({ ...scheduleForm, frequency: value as Frequency })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Daily">Daily</SelectItem>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(scheduleForm.frequency === 'Weekly' ||
              scheduleForm.frequency === 'Fortnightly' ||
              scheduleForm.frequency === 'Custom') && (
              <div>
                <Label>Days of Week</Label>
                <div className="flex gap-2 mt-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${index}`}
                        checked={scheduleForm.days_of_week?.includes(index)}
                        onCheckedChange={(checked) => {
                          const current = scheduleForm.days_of_week || []
                          const updated = checked
                            ? [...current, index]
                            : current.filter((d) => d !== index)
                          setScheduleForm({ ...scheduleForm, days_of_week: updated })
                        }}
                      />
                      <Label htmlFor={`day-${index}`} className="text-xs">
                        {day}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Locations *</Label>
              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto mt-2 space-y-2">
                {locations
                  .filter((l) => l.is_active)
                  .map((location) => (
                    <div key={location.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`loc-${location.id}`}
                        checked={scheduleForm.location_ids?.includes(location.id)}
                        onCheckedChange={(checked) => {
                          const current = scheduleForm.location_ids || []
                          const updated = checked
                            ? [...current, location.id]
                            : current.filter((id) => id !== location.id)
                          setScheduleForm({ ...scheduleForm, location_ids: updated })
                        }}
                      />
                      <Label htmlFor={`loc-${location.id}`} className="flex-1">
                        {location.name} <Badge variant="outline" className="ml-2">{location.type}</Badge>
                      </Label>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            {editingSchedule && (
              <Button
                variant="destructive"
                onClick={() => {
                  handleDeleteSchedule(editingSchedule.id)
                  setScheduleDialogOpen(false)
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchedule}>Save Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageShell>
  )
}
