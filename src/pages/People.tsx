import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, MoreVertical, Mail, Phone, FileText } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Staff } from "@/types"
import { formatCurrency } from "@/lib/currency"
import { StaffDialog } from "@/components/StaffDialog"
import { useDataStore } from "@/lib/store/dataStore"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function People() {
  const navigate = useNavigate()
  const { staff: staffList, setStaff: setStaffList } = useDataStore()
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

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase()
  }

  const getRoleBadgeVariant = (role: Staff["role"]) => {
    switch (role) {
      case "manager": return "default"
      case "supervisor": return "secondary"
      case "crew": return "outline"
      default: return "outline"
    }
  }

  const handleAddStaff = () => {
    setEditingStaff(undefined)
    setDialogOpen(true)
  }

  const handleEditStaff = (staff: Staff) => {
    setEditingStaff(staff)
    setDialogOpen(true)
  }

  const handleSaveStaff = (staff: Staff) => {
    if (editingStaff) {
      setStaffList(staffList.map(s => s.id === staff.id ? staff : s))
    } else {
      setStaffList([...staffList, { 
        ...staff, 
        id: `staff-${Date.now()}`,
        organization_id: 'org-1',
        venue_id: 'venue-1'
      }])
    }
    setDialogOpen(false)
  }

  const handleDeactivateStaff = (staffId: string) => {
    setStaffList(staffList.map(s =>
      s.id === staffId ? { ...s, status: 'inactive' as const } : s
    ))
  }

  const handleActivateStaff = (staffId: string) => {
    setStaffList(staffList.map(s =>
      s.id === staffId ? { ...s, status: 'active' as const } : s
    ))
  }

  const StaffTable = ({ staff }: { staff: Staff[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Staff Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Hourly Rate</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground h-32">
              No staff members found. Click 'Add Staff Member' to get started.
            </TableCell>
          </TableRow>
        ) : (
          staff.map((person) => (
            <TableRow key={person.id}>
              <TableCell>
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() => navigate(`/workforce/people/${person.id}`)}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium">
                    {getInitials(person.name)}
                  </div>
                  <div>
                    <div className="font-medium">{person.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Started {new Date(person.start_date).toLocaleDateString("en-AU", {
                        month: "short",
                        year: "numeric"
                      })}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={getRoleBadgeVariant(person.role)}>
                  {person.role}
                </Badge>
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
              <TableCell className="font-medium">
                {formatCurrency(person.hourly_rate)}/hr
              </TableCell>
              <TableCell>
                <Badge variant={person.status === 'active' ? "default" : "secondary"}>
                  {person.status === 'active' ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                   <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/workforce/people/${person.id}`)}>
                      <FileText className="h-4 w-4 mr-2" />
                      View Profile & Onboarding
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEditStaff(person)}>
                      Edit
                    </DropdownMenuItem>
                    {person.status === 'active' ? (
                      <DropdownMenuItem
                        onClick={() => handleDeactivateStaff(person.id)}
                        className="text-destructive"
                      >
                        Deactivate
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleActivateStaff(person.id)}>
                        Activate
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">People</h1>
          <p className="text-muted-foreground">Manage your team members and their roles</p>
        </div>
        <Button onClick={handleAddStaff}>
          <Plus className="h-4 w-4" />
          Add Staff Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Staff Directory</CardTitle>
              <CardDescription>
                {activeStaff.length} active staff members
              </CardDescription>
            </div>
            <div className="w-72">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">
                Active Staff ({activeStaff.length})
              </TabsTrigger>
              <TabsTrigger value="invitations">
                Invitations (0)
              </TabsTrigger>
              <TabsTrigger value="inactive">
                Inactive ({inactiveStaff.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-6">
              <StaffTable staff={filteredActiveStaff} />
            </TabsContent>

            <TabsContent value="invitations" className="mt-6">
              <div className="text-center py-12 text-muted-foreground">
                <p>No pending invitations</p>
                <p className="text-sm mt-2">Send email invitations to new team members</p>
              </div>
            </TabsContent>

            <TabsContent value="inactive" className="mt-6">
              <StaffTable staff={inactiveStaff} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <StaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        staff={editingStaff}
        onSave={handleSaveStaff}
      />
    </div>
  )
}
