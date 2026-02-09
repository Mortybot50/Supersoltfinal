import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, MoreVertical, Mail, Phone, FileText, Calendar } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Staff } from "@/types"
import { formatCurrency } from "@/lib/currency"
import { StaffDialog } from "@/components/StaffDialog"
import { useDataStore } from "@/lib/store/dataStore"
import { useRosterMetrics } from "@/lib/hooks/useRosterMetrics"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageShell, PageToolbar, PageSidebar, StatusBadge } from "@/components/shared"
import { format } from "date-fns"
import { Users } from "lucide-react"

export default function People() {
  const navigate = useNavigate()
  const { staff: staffList, setStaff: setStaffList } = useDataStore()
  const rosterMetrics = useRosterMetrics()
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | undefined>()

  const activeStaff = staffList.filter(s => s.status === "active")
  const inactiveStaff = staffList.filter(s => s.status === "inactive")

  const filteredActiveStaff = activeStaff.filter(staff => {
    const name = staff.name.toLowerCase()
    return name.includes(searchQuery.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.role.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase()

  const handleAddStaff = () => { setEditingStaff(undefined); setDialogOpen(true) }
  const handleEditStaff = (staff: Staff) => { setEditingStaff(staff); setDialogOpen(true) }

  const handleSaveStaff = (staff: Staff) => {
    if (editingStaff) {
      setStaffList(staffList.map(s => s.id === staff.id ? staff : s))
    } else {
      setStaffList([...staffList, { ...staff, id: `staff-${Date.now()}`, organization_id: 'org-1', venue_id: 'venue-1' }])
    }
    setDialogOpen(false)
  }

  const handleDeactivateStaff = (staffId: string) => {
    setStaffList(staffList.map(s => s.id === staffId ? { ...s, status: 'inactive' as const } : s))
  }

  const handleActivateStaff = (staffId: string) => {
    setStaffList(staffList.map(s => s.id === staffId ? { ...s, status: 'active' as const } : s))
  }

  const StaffTable = ({ staff }: { staff: Staff[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Staff Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Hourly Rate</TableHead>
          <TableHead>Next Shift</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground h-32">
              No staff members found. Click 'Add Staff Member' to get started.
            </TableCell>
          </TableRow>
        ) : (
          staff.map((person) => {
            const upcoming = rosterMetrics.getUpcomingShiftsForStaff(person.id)
            const nextShift = upcoming[0]
            return (
              <TableRow key={person.id}>
                <TableCell>
                  <div className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => navigate(`/workforce/people/${person.id}`)}>
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium">
                      {getInitials(person.name)}
                    </div>
                    <div>
                      <div className="font-medium">{person.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Started {new Date(person.start_date).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={person.role as "manager" | "supervisor" | "crew"} />
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {person.email}
                    </div>
                    {person.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {person.phone}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{formatCurrency(person.hourly_rate)}/hr</TableCell>
                <TableCell>
                  {nextShift ? (
                    <div className="text-xs text-muted-foreground">
                      <div>{format(new Date(nextShift.date), "EEE d MMM")}</div>
                      <div>{nextShift.start_time}-{nextShift.end_time}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No upcoming</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={person.status === 'active' ? 'active' : 'inactive'} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/workforce/people/${person.id}`)}>
                        <FileText className="h-4 w-4 mr-2" /> View Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/workforce/roster')}>
                        <Calendar className="h-4 w-4 mr-2" /> View Roster
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditStaff(person)}>Edit</DropdownMenuItem>
                      {person.status === 'active' ? (
                        <DropdownMenuItem onClick={() => handleDeactivateStaff(person.id)} className="text-destructive">Deactivate</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleActivateStaff(person.id)}>Activate</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )

  const sidebar = (
    <PageSidebar
      title="People"
      metrics={[
        { label: "Active Staff", value: activeStaff.length },
        { label: "Inactive", value: inactiveStaff.length },
      ]}
      quickActions={[
        { label: "View Roster", icon: Calendar, onClick: () => navigate("/workforce/roster") },
      ]}
    />
  )

  const toolbar = (
    <PageToolbar
      title="People"
      filters={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-[200px] pl-8 text-sm"
          />
        </div>
      }
      primaryAction={{ label: "Add Staff", icon: Plus, onClick: handleAddStaff, variant: "teal" }}
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      <div className="p-4">
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">Active ({activeStaff.length})</TabsTrigger>
            <TabsTrigger value="invitations">Invitations (0)</TabsTrigger>
            <TabsTrigger value="inactive">Inactive ({inactiveStaff.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active"><StaffTable staff={filteredActiveStaff} /></TabsContent>
          <TabsContent value="invitations">
            <div className="text-center py-12 text-muted-foreground">
              <p>No pending invitations</p>
              <p className="text-sm mt-2">Send email invitations to new team members</p>
            </div>
          </TabsContent>
          <TabsContent value="inactive"><StaffTable staff={inactiveStaff} /></TabsContent>
        </Tabs>
      </div>

      <StaffDialog open={dialogOpen} onOpenChange={setDialogOpen} staff={editingStaff} onSave={handleSaveStaff} />
    </PageShell>
  )
}
