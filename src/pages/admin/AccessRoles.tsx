import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  MoreVertical,
  Users,
  Shield,
  Grid,
  Key,
  FileText,
  UserX,
  UserCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isValidEmail } from "@/lib/utils/validation";
import { PageShell, PageToolbar } from "@/components/shared";

// Types based on org_members + profiles (the tables that actually exist)
interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: "owner" | "manager" | "supervisor" | "crew";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

type PermissionLevel = "none" | "read" | "write";
type RolePermissions = Record<string, Record<string, PermissionLevel>>;

const PERMISSION_ROLES = ["owner", "manager", "supervisor", "staff"] as const;
const PERMISSION_MODULES = [
  "dashboard",
  "sales",
  "menu",
  "inventory",
  "workforce",
  "operations",
  "settings",
] as const;

const DEFAULT_PERMISSIONS: RolePermissions = {
  owner: {
    dashboard: "write",
    sales: "write",
    menu: "write",
    inventory: "write",
    workforce: "write",
    operations: "write",
    settings: "write",
  },
  manager: {
    dashboard: "read",
    sales: "write",
    menu: "write",
    inventory: "write",
    workforce: "write",
    operations: "write",
    settings: "read",
  },
  supervisor: {
    dashboard: "read",
    sales: "read",
    menu: "read",
    inventory: "write",
    workforce: "read",
    operations: "write",
    settings: "none",
  },
  staff: {
    dashboard: "read",
    sales: "none",
    menu: "read",
    inventory: "none",
    workforce: "read",
    operations: "read",
    settings: "none",
  },
};

export default function AccessRoles() {
  const { currentOrg } = useAuth();
  const [activeTab, setActiveTab] = useState("members");
  const orgId = currentOrg?.id || "";
  const [permissions, setPermissions] =
    useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [permSaving, setPermSaving] = useState(false);

  // Members state (from org_members + profiles)
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<OrgMember[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState<string>("all");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    full_name: "",
    role: "crew" as "manager" | "supervisor" | "crew",
  });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  // Load data when org is available
  useEffect(() => {
    if (!orgId) return;
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]); // loadMembers is a local function — adding it would cause infinite re-render

  useEffect(() => {
    filterMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, memberSearch, memberStatusFilter]); // filterMembers is a local function

  // Load permissions from org settings
  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single()
      .then(({ data }) => {
        const stored = (data?.settings as Record<string, unknown>)
          ?.role_permissions as RolePermissions | undefined;
        if (stored) setPermissions({ ...DEFAULT_PERMISSIONS, ...stored });
      });
  }, [orgId]);

  const handleSavePermissions = async () => {
    if (!orgId) return;
    setPermSaving(true);
    try {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .single();
      const existingSettings =
        (orgData?.settings as Record<string, unknown>) || {};
      const { error } = await supabase
        .from("organizations")
        .update({
          settings: { ...existingSettings, role_permissions: permissions },
        })
        .eq("id", orgId);
      if (error) throw error;
      toast.success("Permissions saved");
    } catch (err) {
      toast.error("Failed to save permissions", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setPermSaving(false);
    }
  };

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from("org_members")
      .select("*, profiles(email, first_name, last_name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Error loading members", { description: error.message });
    } else {
      setMembers((data || []) as OrgMember[]);
    }
  };

  const filterMembers = () => {
    let filtered = members;

    if (memberSearch) {
      filtered = filtered.filter((m) => {
        const name =
          `${m.profiles?.first_name || ""} ${m.profiles?.last_name || ""}`.toLowerCase();
        const email = (m.profiles?.email || "").toLowerCase();
        return (
          name.includes(memberSearch.toLowerCase()) ||
          email.includes(memberSearch.toLowerCase())
        );
      });
    }

    if (memberStatusFilter !== "all") {
      if (memberStatusFilter === "active") {
        filtered = filtered.filter((m) => m.is_active);
      } else if (memberStatusFilter === "inactive") {
        filtered = filtered.filter((m) => !m.is_active);
      }
    }

    setFilteredMembers(filtered);
  };

  const getMemberName = (m: OrgMember) => {
    const first = m.profiles?.first_name || "";
    const last = m.profiles?.last_name || "";
    return `${first} ${last}`.trim() || m.profiles?.email || "Unknown";
  };

  const getMemberInitials = (m: OrgMember) => {
    const first = m.profiles?.first_name || "";
    const last = m.profiles?.last_name || "";
    if (first && last) return `${first[0]}${last[0]}`;
    if (first) return first[0];
    return (m.profiles?.email || "U")[0].toUpperCase();
  };

  const handleInviteMember = async () => {
    const errors: Record<string, string> = {};
    if (!inviteForm.full_name.trim())
      errors.full_name = "Full name is required";
    if (!inviteForm.email.trim()) {
      errors.email = "Email is required";
    } else if (!isValidEmail(inviteForm.email)) {
      errors.email = "Enter a valid email address";
    }
    if (Object.keys(errors).length > 0) {
      setInviteErrors(errors);
      return;
    }
    setInviteErrors({});

    // For now, show a message that full invite flow requires Supabase Edge Functions
    toast.success("Invite flow coming soon", {
      description: `Team member invitations require email sending (Supabase Edge Function). For now, ask ${inviteForm.email} to sign up directly.`,
    });
    setShowInviteDialog(false);
    setInviteForm({ email: "", full_name: "", role: "crew" });
    setInviteErrors({});
  };

  const handleToggleActive = async (
    memberId: string,
    currentlyActive: boolean,
  ) => {
    const { error } = await supabase
      .from("org_members")
      .update({ is_active: !currentlyActive })
      .eq("id", memberId);

    if (error) {
      toast.error("Error updating member", { description: error.message });
      return;
    }

    toast.success("Success", {
      description: `Member ${currentlyActive ? "deactivated" : "activated"}`,
    });
    loadMembers();
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from("org_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast.error("Error updating role", { description: error.message });
      return;
    }

    toast.success("Success", { description: `Role updated to ${newRole}` });
    loadMembers();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "manager":
        return "secondary";
      case "supervisor":
        return "outline";
      default:
        return "outline";
    }
  };

  const toolbar = (
    <PageToolbar
      title="Access & Roles"
      primaryAction={{
        label: "Invite Member",
        icon: Plus,
        onClick: () => setShowInviteDialog(true),
        variant: "primary",
      }}
    />
  );

  return (
    <PageShell toolbar={toolbar}>
      <div className="px-6 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="roles">
              <Shield className="w-4 h-4 mr-2" />
              Roles & Permissions
            </TabsTrigger>
          </TabsList>

          {/* MEMBERS TAB */}
          <TabsContent value="members" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={memberStatusFilter}
                  onValueChange={setMemberStatusFilter}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Dialog
                open={showInviteDialog}
                onOpenChange={setShowInviteDialog}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Invite Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join your organization
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Email Address *</Label>
                      <Input
                        type="email"
                        value={inviteForm.email}
                        onChange={(e) => {
                          setInviteForm({
                            ...inviteForm,
                            email: e.target.value,
                          });
                          setInviteErrors((prev) => ({ ...prev, email: "" }));
                        }}
                        placeholder="name@example.com"
                        className={
                          inviteErrors.email ? "border-destructive" : ""
                        }
                      />
                      {inviteErrors.email && (
                        <p className="text-sm text-destructive mt-1">
                          {inviteErrors.email}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Full Name *</Label>
                      <Input
                        value={inviteForm.full_name}
                        onChange={(e) => {
                          setInviteForm({
                            ...inviteForm,
                            full_name: e.target.value,
                          });
                          setInviteErrors((prev) => ({
                            ...prev,
                            full_name: "",
                          }));
                        }}
                        placeholder="John Smith"
                        className={
                          inviteErrors.full_name ? "border-destructive" : ""
                        }
                      />
                      {inviteErrors.full_name && (
                        <p className="text-sm text-destructive mt-1">
                          {inviteErrors.full_name}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Role *</Label>
                      <Select
                        value={inviteForm.role}
                        onValueChange={(
                          value: "manager" | "supervisor" | "crew",
                        ) => setInviteForm({ ...inviteForm, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="crew">Crew</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowInviteDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleInviteMember}>
                      Send Invitation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No team members yet</p>
                        <p className="text-sm">
                          Invite your first teammate to get started
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                              {getMemberInitials(member)}
                            </div>
                            <span className="font-medium">
                              {getMemberName(member)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{member.profiles?.email || "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={member.role}
                            onValueChange={(value) =>
                              handleChangeRole(member.id, value)
                            }
                            disabled={member.role === "owner"}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <Badge
                                variant={
                                  getRoleBadgeVariant(member.role) as
                                    | "default"
                                    | "secondary"
                                    | "outline"
                                }
                                className="capitalize"
                              >
                                {member.role}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="supervisor">
                                Supervisor
                              </SelectItem>
                              <SelectItem value="crew">Crew</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={member.is_active ? "default" : "outline"}
                          >
                            {member.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {member.role !== "owner" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="More actions"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleToggleActive(
                                      member.id,
                                      member.is_active,
                                    )
                                  }
                                >
                                  {member.is_active ? (
                                    <>
                                      <UserX className="w-4 h-4 mr-2" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-4 h-4 mr-2" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ROLES TAB */}
          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Permission Grid</CardTitle>
                  <CardDescription>
                    Control what each role can see and do across modules
                  </CardDescription>
                </div>
                <Button
                  onClick={handleSavePermissions}
                  disabled={permSaving}
                  size="sm"
                >
                  {permSaving ? "Saving..." : "Save Permissions"}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 pr-4 font-medium text-muted-foreground w-28">
                          Role
                        </th>
                        {PERMISSION_MODULES.map((mod) => (
                          <th
                            key={mod}
                            className="text-center py-2 px-2 font-medium text-muted-foreground capitalize min-w-[90px]"
                          >
                            {mod}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_ROLES.map((role) => (
                        <tr key={role} className="border-t">
                          <td className="py-2 pr-4 font-medium capitalize">
                            {role}
                          </td>
                          {PERMISSION_MODULES.map((mod) => (
                            <td key={mod} className="py-2 px-2 text-center">
                              <Select
                                value={permissions[role]?.[mod] ?? "none"}
                                onValueChange={(val: PermissionLevel) =>
                                  setPermissions((prev) => ({
                                    ...prev,
                                    [role]: { ...prev[role], [mod]: val },
                                  }))
                                }
                                disabled={role === "owner"}
                              >
                                <SelectTrigger className="h-7 w-20 text-xs mx-auto">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">None</SelectItem>
                                  <SelectItem value="read">Read</SelectItem>
                                  <SelectItem value="write">Write</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Owner always has full write access to all modules.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
