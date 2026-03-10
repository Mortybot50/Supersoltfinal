"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Edit, Copy, Check } from "lucide-react"
import { format } from "date-fns"

interface Staff {
  id: string
  orgId: string
  venueId: string | null
  name: string
  email: string
  phone: string | null
  roleTitle: string
  hourlyRateCents: number
  isActive: boolean
  createdAt: string
}

interface Invite {
  id: string
  orgId: string
  email: string
  role: string
  token: string
  status: string
  createdAt: string
  expiresAt: string
}

const staffFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  roleTitle: z.string().min(1, "Role title is required"),
  hourlyRateCents: z.coerce.number().min(0, "Rate must be positive"),
})

function CreateInviteButton() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"manager" | "supervisor" | "crew">("manager")
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setEmail("")
      setRole("manager")
      setInviteToken(null)
      setCopiedToken(false)
    }
  }

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!email || !email.trim()) {
        throw new Error("Email is required")
      }
      
      const res = await fetch("/api/people/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create invite")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invites"] })
      setInviteToken(data.token)
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const inviteUrl = `${baseUrl}/invite/${data.token}`
      navigator.clipboard.writeText(inviteUrl)
      
      toast({
        title: "Invite created and copied to clipboard",
        description: `Shareable link copied for ${email}`,
      })
      
      setEmail("")
      setRole("manager")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleCopyToken = () => {
    if (inviteToken) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const inviteUrl = `${baseUrl}/invite/${inviteToken}`
      navigator.clipboard.writeText(inviteUrl)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
      toast({
        title: "Copied",
        description: "Invite link copied to clipboard",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-invite">
          <Plus className="h-4 w-4 mr-2" />
          Create Invite
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-create-invite">
        <DialogHeader>
          <DialogTitle>Create Invite</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization
          </DialogDescription>
        </DialogHeader>
        {inviteToken ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invite created successfully! Share this link with the recipient:
            </p>
            <div className="flex items-center gap-2">
              <Input 
                value={`${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/invite/${inviteToken}`} 
                readOnly 
                data-testid="input-invite-token" 
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyToken}
                data-testid="button-copy-token"
              >
                {copiedToken ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)} data-testid="button-close-invite-dialog">
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                data-testid="input-invite-email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={role} onValueChange={(val) => setRole(val as any)}>
                <SelectTrigger id="invite-role" data-testid="select-invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="crew">Crew</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createInvite.mutate()}
                disabled={!email || createInvite.isPending}
                data-testid="button-submit-invite"
              >
                {createInvite.isPending ? "Creating..." : "Create Invite"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function PeoplePage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false)
  const [isEditStaffOpen, setIsEditStaffOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)

  const { data: staffList, isLoading: staffLoading } = useQuery<Staff[]>({
    queryKey: ["/api/people/staff"],
  })

  const { data: invitesList, isLoading: invitesLoading } = useQuery<Invite[]>({
    queryKey: ["invites"],
    queryFn: async () => {
      const res = await fetch("/api/people/invites")
      if (!res.ok) throw new Error("Failed to fetch invites")
      return res.json()
    },
  })

  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/people/invites/${inviteId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to cancel invite")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] })
      toast({
        title: "Success",
        description: "Invite cancelled successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const addStaffForm = useForm<z.infer<typeof staffFormSchema>>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      roleTitle: "",
      hourlyRateCents: 0,
    },
  })

  const editStaffForm = useForm<z.infer<typeof staffFormSchema>>({
    resolver: zodResolver(staffFormSchema),
  })

  const createStaffMutation = useMutation({
    mutationFn: async (data: z.infer<typeof staffFormSchema>) => {
      const res = await apiRequest("POST", "/api/people/staff", data)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people/staff"] })
      setIsAddStaffOpen(false)
      addStaffForm.reset()
      toast({
        title: "Success",
        description: "Staff member added successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const updateStaffMutation = useMutation({
    mutationFn: async (data: z.infer<typeof staffFormSchema> & { id: string }) => {
      const res = await apiRequest("PUT", "/api/people/staff", data)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/people/staff"] })
      setIsEditStaffOpen(false)
      setEditingStaff(null)
      toast({
        title: "Success",
        description: "Staff member updated successfully",
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleEditStaff = (staff: Staff) => {
    setEditingStaff(staff)
    editStaffForm.reset({
      name: staff.name,
      email: staff.email,
      phone: staff.phone || "",
      roleTitle: staff.roleTitle,
      hourlyRateCents: staff.hourlyRateCents,
    })
    setIsEditStaffOpen(true)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          People
        </h1>
      </div>

      <Tabs defaultValue="staff" className="w-full">
        <TabsList data-testid="tabs-people">
          <TabsTrigger value="staff" data-testid="tab-staff">
            Staff
          </TabsTrigger>
          <TabsTrigger value="invites" data-testid="tab-invites">
            Invites
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Staff Members</h2>
                <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-staff">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Staff
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="dialog-add-staff">
                    <DialogHeader>
                      <DialogTitle>Add Staff Member</DialogTitle>
                      <DialogDescription>
                        Add a new staff member to your organization
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...addStaffForm}>
                      <form onSubmit={addStaffForm.handleSubmit((data) => createStaffMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={addStaffForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-staff-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addStaffForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" data-testid="input-staff-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addStaffForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-staff-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addStaffForm.control}
                          name="roleTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Role Title</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-staff-role" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={addStaffForm.control}
                          name="hourlyRateCents"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Hourly Rate (cents)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" data-testid="input-staff-rate" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="submit" disabled={createStaffMutation.isPending} data-testid="button-submit-staff">
                            {createStaffMutation.isPending ? "Adding..." : "Add Staff"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {staffLoading ? (
                <p className="text-muted-foreground">Loading staff...</p>
              ) : !staffList || staffList.length === 0 ? (
                <p className="text-muted-foreground">No staff members found</p>
              ) : (
                <Table data-testid="table-staff">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffList.map((staff) => (
                      <TableRow key={staff.id} data-testid={`row-staff-${staff.id}`}>
                        <TableCell data-testid={`text-staff-name-${staff.id}`}>{staff.name}</TableCell>
                        <TableCell data-testid={`text-staff-email-${staff.id}`}>{staff.email}</TableCell>
                        <TableCell>{staff.phone || "-"}</TableCell>
                        <TableCell>{staff.roleTitle}</TableCell>
                        <TableCell>A${(staff.hourlyRateCents / 100).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={staff.isActive ? "default" : "secondary"} data-testid={`badge-staff-status-${staff.id}`}>
                            {staff.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStaff(staff)}
                            data-testid={`button-edit-staff-${staff.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Pending Invites</h2>
                <CreateInviteButton />
              </div>

              {invitesLoading ? (
                <p className="text-muted-foreground">Loading invites...</p>
              ) : !invitesList || invitesList.filter(i => i.status === "pending").length === 0 ? (
                <p className="text-muted-foreground">No pending invites</p>
              ) : (
                <Table data-testid="table-invites">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitesList
                      .filter((invite) => invite.status === "pending")
                      .map((invite) => (
                        <TableRow key={invite.id} data-testid={`row-invite-${invite.id}`}>
                          <TableCell data-testid={`text-invite-email-${invite.id}`}>{invite.email}</TableCell>
                          <TableCell>{invite.role}</TableCell>
                          <TableCell>{format(new Date(invite.expiresAt), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" data-testid={`badge-invite-status-${invite.id}`}>
                              {invite.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
                                  const inviteUrl = `${baseUrl}/invite/${invite.token}`
                                  navigator.clipboard.writeText(inviteUrl)
                                  toast({
                                    title: "Copied",
                                    description: "Invite link copied to clipboard",
                                  })
                                }}
                                data-testid={`button-copy-invite-${invite.id}`}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Link
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelInviteMutation.mutate(invite.id)}
                                disabled={cancelInviteMutation.isPending}
                                data-testid={`button-cancel-invite-${invite.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditStaffOpen} onOpenChange={setIsEditStaffOpen}>
        <DialogContent data-testid="dialog-edit-staff">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update staff member information
            </DialogDescription>
          </DialogHeader>
          <Form {...editStaffForm}>
            <form onSubmit={editStaffForm.handleSubmit((data) => {
              if (editingStaff) {
                updateStaffMutation.mutate({ ...data, id: editingStaff.id })
              }
            })} className="space-y-4">
              <FormField
                control={editStaffForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-staff-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStaffForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-staff-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStaffForm.control}
                name="roleTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Title</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-staff-role" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editStaffForm.control}
                name="hourlyRateCents"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly Rate (cents)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" data-testid="input-edit-staff-rate" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateStaffMutation.isPending} data-testid="button-submit-edit-staff">
                  {updateStaffMutation.isPending ? "Updating..." : "Update Staff"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
