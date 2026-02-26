import React from 'react'
import { useAuth } from "@/contexts/AuthContext"
import { useState, useMemo } from "react"
import { useDebounce } from '@/lib/hooks/useDebounce'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Search, Plus, MoreVertical, Mail, Phone, FileText, Calendar, Send, Copy, Check, Clock, UserPlus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Staff, OnboardingInvite, OnboardingStep } from "@/types"
import { formatCurrency } from "@/lib/currency"
import { StaffDialog } from "@/components/StaffDialog"
import { useDataStore } from "@/lib/store/dataStore"
import { useRosterMetrics } from "@/lib/hooks/useRosterMetrics"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageShell, PageToolbar, StatusBadge } from "@/components/shared"
import { StatCards } from "@/components/ui/StatCards"
import { SecondaryStats } from "@/components/ui/SecondaryStats"
import { format } from "date-fns"
import { Users } from "lucide-react"
import { updateStaffInDB, toggleStaffActiveInDB } from "@/lib/services/labourService"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { isValidEmail } from "@/lib/utils/validation"
import { generateSecureToken, generateInviteUrl } from "@/lib/utils/tokenGenerator"
import { ONBOARDING_STEPS, INVITE_EXPIRY_DAYS } from "@/lib/constants/onboarding"

export default function People() {
  const { currentOrg, currentVenue, user } = useAuth()
  const navigate = useNavigate()
  const { staff: staffList, setStaff: setStaffList, onboardingInvites, addOnboardingInvite, updateStaffOnboarding, setOnboardingSteps, onboardingSteps } = useDataStore()
  const rosterMetrics = useRosterMetrics()
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | undefined>()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState("")
  const [inviteForm, setInviteForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    role: "crew" as "manager" | "supervisor" | "crew",
    employment_type: "casual" as "full-time" | "part-time" | "casual",
    hourly_rate: "",
  })

  const activeStaff = staffList.filter(s => s.status === "active" && s.onboarding_status === "roster_ready")
  const inactiveStaff = staffList.filter(s => s.status === "inactive")

  // Staff with pending invitations (invited, in_progress, pending_review, not_started)
  const invitedStaff = useMemo(() => {
    return staffList.filter(s =>
      s.status === "active" &&
      s.onboarding_status !== "roster_ready"
    ).map(s => {
      const invite = onboardingInvites.filter(i => i.staff_id === s.id).sort((a, b) =>
        new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      )[0]
      const steps = onboardingSteps.filter(st => st.staff_id === s.id)
      const completedSteps = steps.filter(st => st.status === "completed").length
      return { staff: s, invite, completedSteps }
    })
  }, [staffList, onboardingInvites, onboardingSteps])

  const filteredActiveStaff = activeStaff.filter(staff => {
    const name = staff.name.toLowerCase()
    return name.includes(debouncedSearch.toLowerCase()) ||
      staff.email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      staff.role.toLowerCase().includes(debouncedSearch.toLowerCase())
  })

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase()

  const handleAddStaff = () => { setEditingStaff(undefined); setDialogOpen(true) }
  const handleEditStaff = (staff: Staff) => { setEditingStaff(staff); setDialogOpen(true) }

  const handleSaveStaff = async (staff: Staff) => {
    if (editingStaff) {
      // Edit existing staff — persist to Supabase
      const success = await updateStaffInDB(staff.id, staff)
      if (success) {
        setStaffList(staffList.map(s => s.id === staff.id ? staff : s))
        toast.success(`${staff.name} updated successfully`)
      } else {
        toast.error('Failed to update staff member')
      }
    } else {
      // Add new — update store (DB insert requires auth user + org_member flow)
      setStaffList([...staffList, { ...staff, id: `staff-${Date.now()}`, organization_id: currentOrg?.id || '', venue_id: currentVenue?.id || '' }])
      toast.success(`${staff.name} added`)
    }
    setDialogOpen(false)
  }

  const handleDeactivateStaff = async (staffId: string) => {
    const success = await toggleStaffActiveInDB(staffId, false)
    if (success) {
      setStaffList(staffList.map(s => s.id === staffId ? { ...s, status: 'inactive' as const } : s))
      toast.success('Staff member deactivated')
    } else {
      toast.error('Failed to deactivate staff member')
    }
  }

  const handleActivateStaff = async (staffId: string) => {
    const success = await toggleStaffActiveInDB(staffId, true)
    if (success) {
      setStaffList(staffList.map(s => s.id === staffId ? { ...s, status: 'active' as const } : s))
      toast.success('Staff member activated')
    } else {
      toast.error('Failed to activate staff member')
    }
  }

  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({})

  // Load invites from Supabase on mount
  React.useEffect(() => {
    const loadInvites = async () => {
      if (!currentOrg?.id) return
      const { data, error } = await supabase
        .from('staff_invites')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('sent_at', { ascending: false })
      if (error) {
        console.error('Failed to load invites:', error)
        return
      }
      if (data) {
        const invites: OnboardingInvite[] = data.map(row => ({
          id: row.id,
          staff_id: row.staff_id,
          token: row.token,
          sent_to_email: row.sent_to_email,
          sent_at: new Date(row.sent_at),
          expires_at: new Date(row.expires_at),
          accessed_at: row.accessed_at ? new Date(row.accessed_at) : undefined,
          completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
        }))
        setOnboardingInvites(invites)
      }
    }
    loadInvites()
  }, [currentOrg?.id])

  const handleSendInvite = async () => {
    const errors: Record<string, string> = {}
    if (!inviteForm.first_name.trim()) errors.first_name = 'First name is required'
    if (!inviteForm.email.trim()) {
      errors.email = 'Email is required'
    } else if (!isValidEmail(inviteForm.email)) {
      errors.email = 'Enter a valid email address'
    }
    if (inviteForm.hourly_rate && parseFloat(inviteForm.hourly_rate) < 0) {
      errors.hourly_rate = 'Hourly rate must be positive'
    }
    if (Object.keys(errors).length > 0) {
      setInviteErrors(errors)
      return
    }
    setInviteErrors({})

    const staffName = `${inviteForm.first_name} ${inviteForm.last_name}`.trim()
    const staffId = `staff-${Date.now()}`
    const token = generateSecureToken()
    const inviteUrl = generateInviteUrl(token)
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + INVITE_EXPIRY_DAYS)

    // Create staff record with onboarding_status = invited
    const newStaff: Staff = {
      id: staffId,
      organization_id: currentOrg?.id || '',
      venue_id: currentVenue?.id || "",
      name: staffName,
      email: inviteForm.email,
      role: inviteForm.role,
      employment_type: inviteForm.employment_type,
      hourly_rate: inviteForm.hourly_rate ? Math.round(parseFloat(inviteForm.hourly_rate) * 100) : 0,
      start_date: new Date(),
      status: "active",
      onboarding_status: "invited",
      onboarding_progress: 0,
      tfn_exemption: false,
      tfn_claimed_tax_free_threshold: false,
      tfn_has_help_debt: false,
      tfn_has_tsl_debt: false,
      tfn_tax_offset_claimed: false,
      super_use_employer_default: false,
    }

    // Create invite record
    const invite: OnboardingInvite = {
      id: `invite-${Date.now()}`,
      staff_id: staffId,
      token,
      sent_to_email: inviteForm.email,
      sent_at: new Date(),
      expires_at: expiryDate,
    }

    // Create onboarding step records for this staff member
    const stepRecords: OnboardingStep[] = ONBOARDING_STEPS.map(step => ({
      id: `step-${staffId}-${step.number}`,
      staff_id: staffId,
      step_number: step.number,
      step_name: step.name,
      status: "not_started" as const,
    }))

    // Persist invite to Supabase first, then update Zustand
    if (currentOrg?.id) {
      const { error: inviteError } = await supabase
        .from('staff_invites')
        .insert({
          org_id: currentOrg.id,
          staff_id: null,
          token,
          sent_to_email: inviteForm.email,
          sent_at: new Date().toISOString(),
          expires_at: expiryDate.toISOString(),
          invited_by: user?.id ?? null,
        })
      if (inviteError) {
        console.error('Failed to persist invite:', inviteError)
        toast.error('Failed to save invite: ' + inviteError.message)
        return
      }
    }

    setStaffList([...staffList, newStaff])
    addOnboardingInvite(invite)
    setOnboardingSteps([...onboardingSteps, ...stepRecords])

    // Copy URL to clipboard
    navigator.clipboard.writeText(inviteUrl)
    setCopiedUrl(inviteUrl)

    toast.success(`Invite sent to ${inviteForm.email}`, {
      description: "Invite link copied to clipboard",
    })

    // Reset form but keep dialog open to show the URL
    setInviteForm({ first_name: "", last_name: "", email: "", role: "crew", employment_type: "casual", hourly_rate: "" })
  }

  const handleCopyInviteUrl = (token: string) => {
    const url = generateInviteUrl(token)
    navigator.clipboard.writeText(url)
    toast.success("Invite link copied to clipboard")
  }

  const handleResendInvite = async (staffMember: Staff) => {
    const token = generateSecureToken()
    const inviteUrl = generateInviteUrl(token)
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + INVITE_EXPIRY_DAYS)

    const invite: OnboardingInvite = {
      id: `invite-${Date.now()}`,
      staff_id: staffMember.id,
      token,
      sent_to_email: staffMember.email,
      sent_at: new Date(),
      expires_at: expiryDate,
    }

    // Persist to Supabase first
    if (currentOrg?.id) {
      const { error } = await supabase
        .from('staff_invites')
        .insert({
          org_id: currentOrg.id,
          staff_id: staffMember.id,
          token,
          sent_to_email: staffMember.email,
          sent_at: new Date().toISOString(),
          expires_at: expiryDate.toISOString(),
          invited_by: user?.id ?? null,
        })
      if (error) {
        console.error('Failed to persist invite:', error)
        toast.error('Failed to save invite')
        return
      }
    }

    addOnboardingInvite(invite)
    navigator.clipboard.writeText(inviteUrl)
    toast.success(`New invite sent to ${staffMember.email}`, {
      description: "Link copied to clipboard",
    })
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

  const pendingReviewCount = invitedStaff.filter(s => s.staff.onboarding_status === "pending_review").length

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
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => { setCopiedUrl(""); setInviteDialogOpen(true) }}>
            <UserPlus className="h-4 w-4 mr-1" />
            Invite Staff
          </Button>
        </div>
      }
      primaryAction={{ label: "Add Staff", icon: Plus, onClick: handleAddStaff, variant: "primary" }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-4 pt-4 space-y-3">
        <StatCards stats={[
          { label: "Active Staff", value: activeStaff.length },
          { label: "Onboarding", value: invitedStaff.length },
          { label: "Inactive", value: inactiveStaff.length },
        ]} columns={3} />
        <SecondaryStats stats={[
          { label: "Pending Review", value: pendingReviewCount },
        ]} />
      </div>
      <div className="p-4">
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">Active ({activeStaff.length})</TabsTrigger>
            <TabsTrigger value="invitations">Invitations ({invitedStaff.length})</TabsTrigger>
            <TabsTrigger value="inactive">Inactive ({inactiveStaff.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active"><StaffTable staff={filteredActiveStaff} /></TabsContent>
          <TabsContent value="invitations">
            {invitedStaff.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No pending invitations</p>
                <p className="text-sm mt-1">Click "Invite Staff" to send onboarding invitations</p>
                <Button variant="outline" className="mt-4" onClick={() => { setCopiedUrl(""); setInviteDialogOpen(true) }}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Staff
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitedStaff.map(({ staff: person, invite, completedSteps }) => {
                    const statusLabel = person.onboarding_status.replace(/_/g, " ")
                    const isExpired = invite && new Date(invite.expires_at) < new Date()
                    return (
                      <TableRow key={person.id}>
                        <TableCell>
                          <div className="flex items-center gap-3 cursor-pointer hover:opacity-70" onClick={() => navigate(`/workforce/people/${person.id}`)}>
                            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-medium">
                              {getInitials(person.name)}
                            </div>
                            <span className="font-medium">{person.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{person.email}</TableCell>
                        <TableCell><StatusBadge status={person.role as "manager" | "supervisor" | "crew"} /></TableCell>
                        <TableCell>
                          <Badge variant={
                            person.onboarding_status === "pending_review" ? "secondary" :
                            person.onboarding_status === "in_progress" ? "outline" :
                            "default"
                          } className="capitalize">
                            {isExpired && person.onboarding_status === "invited" ? "Expired" : statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-muted rounded-full h-1.5">
                              <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${(completedSteps / ONBOARDING_STEPS.length) * 100}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{completedSteps}/{ONBOARDING_STEPS.length}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {invite ? format(new Date(invite.sent_at), "dd MMM yyyy") : "—"}
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
                              {invite && (
                                <DropdownMenuItem onClick={() => handleCopyInviteUrl(invite.token)}>
                                  <Copy className="h-4 w-4 mr-2" /> Copy Invite Link
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleResendInvite(person)}>
                                <Send className="h-4 w-4 mr-2" /> Resend Invite
                              </DropdownMenuItem>
                              {person.onboarding_status === "pending_review" && (
                                <DropdownMenuItem onClick={() => {
                                  updateStaffOnboarding(person.id, {
                                    onboarding_status: "roster_ready",
                                    onboarding_completed_at: new Date(),
                                    onboarding_progress: 100,
                                  })
                                  toast.success(`${person.name} approved and roster-ready`)
                                }}>
                                  <Check className="h-4 w-4 mr-2" /> Approve
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="inactive"><StaffTable staff={inactiveStaff} /></TabsContent>
        </Tabs>
      </div>

      <StaffDialog open={dialogOpen} onOpenChange={setDialogOpen} staff={editingStaff} onSave={handleSaveStaff} />

      {/* Invite Staff Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Staff Member</DialogTitle>
          </DialogHeader>

          {copiedUrl ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-green-50 p-4 text-center">
                <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium">Invite Created</p>
                <p className="text-sm text-muted-foreground mt-1">Share this link with your new team member</p>
              </div>
              <div className="flex items-center gap-2">
                <Input value={copiedUrl} readOnly className="text-xs font-mono" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(copiedUrl); toast.success("Copied!") }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Done</Button>
                <Button onClick={() => setCopiedUrl("")}>Invite Another</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="inv_first_name">First Name *</Label>
                  <Input id="inv_first_name" value={inviteForm.first_name} onChange={e => { setInviteForm({ ...inviteForm, first_name: e.target.value }); setInviteErrors(prev => ({ ...prev, first_name: '' })) }} placeholder="Jane" className={inviteErrors.first_name ? 'border-destructive' : ''} />
                  {inviteErrors.first_name && <p className="text-sm text-destructive mt-1">{inviteErrors.first_name}</p>}
                </div>
                <div>
                  <Label htmlFor="inv_last_name">Last Name</Label>
                  <Input id="inv_last_name" value={inviteForm.last_name} onChange={e => setInviteForm({ ...inviteForm, last_name: e.target.value })} placeholder="Smith" />
                </div>
              </div>
              <div>
                <Label htmlFor="inv_email">Email *</Label>
                <Input id="inv_email" type="email" value={inviteForm.email} onChange={e => { setInviteForm({ ...inviteForm, email: e.target.value }); setInviteErrors(prev => ({ ...prev, email: '' })) }} placeholder="jane@example.com" className={inviteErrors.email ? 'border-destructive' : ''} />
                {inviteErrors.email && <p className="text-sm text-destructive mt-1">{inviteErrors.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Role</Label>
                  <Select value={inviteForm.role} onValueChange={v => setInviteForm({ ...inviteForm, role: v as "manager" | "supervisor" | "crew" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crew">Crew</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Employment Type</Label>
                  <Select value={inviteForm.employment_type} onValueChange={v => setInviteForm({ ...inviteForm, employment_type: v as "full-time" | "part-time" | "casual" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="full-time">Full-time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="inv_rate">Hourly Rate ($)</Label>
                <Input id="inv_rate" type="number" step="0.01" min="0" value={inviteForm.hourly_rate} onChange={e => { setInviteForm({ ...inviteForm, hourly_rate: e.target.value }); setInviteErrors(prev => ({ ...prev, hourly_rate: '' })) }} placeholder="28.50" className={inviteErrors.hourly_rate ? 'border-destructive' : ''} />
                {inviteErrors.hourly_rate && <p className="text-sm text-destructive mt-1">{inviteErrors.hourly_rate}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSendInvite}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Invite
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
