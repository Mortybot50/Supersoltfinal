import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, MoreVertical, Users, Shield, Grid, Key, FileText, Copy, RotateCw, UserX, UserCheck } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isValidEmail } from '@/lib/utils/validation';
import { PageShell, PageToolbar } from '@/components/shared';

// Types
type MemberStatus = 'active' | 'invited' | 'suspended' | 'deactivated';
type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

interface Member {
  id: string;
  org_id: string;
  user_id?: string;
  primary_email: string;
  full_name: string;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
}

interface RoleDefinition {
  id: string;
  org_id: string;
  key: string;
  description?: string;
  can_edit: boolean;
  approval_limits: {
    price_change_percent?: number;
    po_amount?: number;
    roster_over_percent?: number;
  };
  permissions: Record<string, Record<string, boolean>>;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

interface Assignment {
  id: string;
  org_id: string;
  member_id: string;
  role_id: string;
  venue_id?: string;
  created_at: string;
  updated_at: string;
  role_definitions?: RoleDefinition;
}

interface Pin {
  id: string;
  org_id: string;
  member_id: string;
  pin_hash: string;
  pin_last4: string;
  is_active: boolean;
  last_rotated_at: string;
  created_at: string;
  updated_at: string;
  members?: Member;
}

interface AuditRecord {
  id: string;
  org_id: string;
  actor_member_id?: string;
  action: string;
  target?: Record<string, unknown>;
  before_snapshot?: Record<string, unknown>;
  after_snapshot?: Record<string, unknown>;
  created_at: string;
}

const MODULES = [
  { key: 'inventory', label: 'Inventory' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'menu_items', label: 'Menu Items' },
  { key: 'purchasing', label: 'Purchasing' },
  { key: 'workforce', label: 'Workforce' },
  { key: 'time_attendance', label: 'Time & Attendance' },
  { key: 'cash_flow', label: 'Cash Flow' },
  { key: 'insights', label: 'Insights' },
  { key: 'food_safety', label: 'Food Safety' },
  { key: 'daybook', label: 'Daybook' },
  { key: 'automation', label: 'Automation' },
  { key: 'admin_org', label: 'Admin: Org Settings' },
  { key: 'admin_venue', label: 'Admin: Venue Settings' },
  { key: 'admin_data', label: 'Admin: Data Management' },
  { key: 'admin_roles', label: 'Admin: Access & Roles' },
];

const OPERATIONS = ['read', 'create', 'update', 'delete', 'export', 'approve'];

export default function AccessRoles() {
  const { toast } = useToast();
  const { currentOrg } = useAuth();
  const [activeTab, setActiveTab] = useState('members');
  const orgId = currentOrg?.id || '';

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<string>('all');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role_id: '',
    venue_id: '',
    message: '',
  });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  // Roles state
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleDefinition | null>(null);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);

  // Assignments state
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // PINs state
  const [pins, setPins] = useState<Pin[]>([]);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string>('');
  const [selectedMemberForPin, setSelectedMemberForPin] = useState<string>('');

  // Audit state
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [auditDateRange, setAuditDateRange] = useState<string>('7');

  // Load data when org is available
  useEffect(() => {
    if (!orgId) return;
    loadMembers();
    loadRoles();
    loadAssignments();
    loadPins();
    loadAuditRecords();
  }, [orgId]);

  useEffect(() => {
    filterMembers();
  }, [members, memberSearch, memberStatusFilter]);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading members', description: error.message, variant: 'destructive' });
    } else {
      setMembers(data || []);
    }
  };

  const loadRoles = async () => {
    const { data, error } = await supabase
      .from('role_definitions')
      .select('*')
      .eq('org_id', orgId)
      .order('is_system', { ascending: false });

    if (error) {
      toast({ title: 'Error loading roles', description: error.message, variant: 'destructive' });
    } else {
      const rolesData = (data || []) as RoleDefinition[];
      setRoles(rolesData);
      if (rolesData.length > 0 && !selectedRole) {
        setSelectedRole(rolesData[0]);
      }
    }
  };

  const loadAssignments = async () => {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, role_definitions(*)')
      .eq('org_id', orgId);

    if (error) {
      toast({ title: 'Error loading assignments', description: error.message, variant: 'destructive' });
    } else {
      setAssignments((data || []) as Assignment[]);
    }
  };

  const loadPins = async () => {
    const { data, error } = await supabase
      .from('pins')
      .select('*, members(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading PINs', description: error.message, variant: 'destructive' });
    } else {
      setPins(data || []);
    }
  };

  const loadAuditRecords = async () => {
    const daysAgo = parseInt(auditDateRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const { data, error } = await supabase
      .from('access_audit')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      toast({ title: 'Error loading audit records', description: error.message, variant: 'destructive' });
    } else {
      setAuditRecords(data || []);
    }
  };

  const filterMembers = () => {
    let filtered = members;

    if (memberSearch) {
      filtered = filtered.filter(m =>
        m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.primary_email.toLowerCase().includes(memberSearch.toLowerCase())
      );
    }

    if (memberStatusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === memberStatusFilter);
    }

    setFilteredMembers(filtered);
  };

  const handleInviteMember = async () => {
    const errors: Record<string, string> = {};
    if (!inviteForm.full_name.trim()) errors.full_name = 'Full name is required';
    if (!inviteForm.email.trim()) {
      errors.email = 'Email is required';
    } else if (!isValidEmail(inviteForm.email)) {
      errors.email = 'Enter a valid email address';
    }
    if (!inviteForm.role_id) errors.role_id = 'Role is required';
    if (Object.keys(errors).length > 0) {
      setInviteErrors(errors);
      return;
    }
    setInviteErrors({});

    // Create member
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .insert({
        org_id: orgId,
        primary_email: inviteForm.email,
        full_name: inviteForm.full_name,
        status: 'invited',
      })
      .select()
      .single();

    if (memberError) {
      toast({ title: 'Error creating member', description: memberError.message, variant: 'destructive' });
      return;
    }

    // Create invite
    const inviteToken = crypto.randomUUID();
    const { error: inviteError } = await supabase
      .from('invites')
      .insert({
        org_id: orgId,
        email: inviteForm.email,
        role_id: inviteForm.role_id,
        venue_id: inviteForm.venue_id || null,
        invite_token: inviteToken,
        status: 'pending',
      });

    if (inviteError) {
      toast({ title: 'Error creating invite', description: inviteError.message, variant: 'destructive' });
      return;
    }

    // Create assignment
    const { error: assignmentError } = await supabase
      .from('assignments')
      .insert({
        org_id: orgId,
        member_id: memberData.id,
        role_id: inviteForm.role_id,
        venue_id: inviteForm.venue_id || null,
      });

    if (assignmentError) {
      toast({ title: 'Error creating assignment', description: assignmentError.message, variant: 'destructive' });
      return;
    }

    // Create audit record
    await supabase.from('access_audit').insert([{
      org_id: orgId,
      action: 'invite.send',
      target: { member_id: memberData.id, email: inviteForm.email } as Record<string, unknown>,
    }]);

    toast({ title: 'Success', description: `Invitation sent to ${inviteForm.email}` });
    setShowInviteDialog(false);
    setInviteForm({ email: '', full_name: '', role_id: '', venue_id: '', message: '' });
    setInviteErrors({});
    loadMembers();
    loadAssignments();
  };

  const handleGeneratePin = async () => {
    if (!selectedMemberForPin) {
      toast({ title: 'Error', description: 'Please select a member', variant: 'destructive' });
      return;
    }

    // Generate random 4-digit PIN
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedPin(pin);

    // PIN hashing should be done server-side via Supabase Edge Function
    const pinHash = pin;

    const { error } = await supabase
      .from('pins')
      .insert({
        org_id: orgId,
        member_id: selectedMemberForPin,
        pin_hash: pinHash,
        pin_last4: '****',
        is_active: true,
        last_rotated_at: new Date().toISOString(),
      });

    if (error) {
      toast({ title: 'Error generating PIN', description: error.message, variant: 'destructive' });
      return;
    }

    // Create audit record
    await supabase.from('access_audit').insert([{
      org_id: orgId,
      action: 'pin.generate',
      target: { member_id: selectedMemberForPin } as Record<string, unknown>,
    }]);

    // Copy to clipboard
    navigator.clipboard.writeText(pin);
    toast({ title: 'PIN Generated', description: 'PIN copied to clipboard' });
    loadPins();
  };

  const handleRotatePin = async (pinId: string, memberId: string) => {
    // Generate new PIN
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    const pinHash = newPin;

    // Deactivate old PIN
    await supabase
      .from('pins')
      .update({ is_active: false })
      .eq('id', pinId);

    // Create new PIN
    const { error } = await supabase
      .from('pins')
      .insert({
        org_id: orgId,
        member_id: memberId,
        pin_hash: pinHash,
        pin_last4: '****',
        is_active: true,
        last_rotated_at: new Date().toISOString(),
      });

    if (error) {
      toast({ title: 'Error rotating PIN', description: error.message, variant: 'destructive' });
      return;
    }

    // Create audit record
    await supabase.from('access_audit').insert([{
      org_id: orgId,
      action: 'pin.rotate',
      target: { member_id: memberId } as Record<string, unknown>,
    }]);

    navigator.clipboard.writeText(newPin);
    toast({ title: 'PIN Rotated', description: 'New PIN copied to clipboard' });
    loadPins();
  };

  const handleSuspendMember = async (memberId: string, currentStatus: MemberStatus) => {
    const newStatus: MemberStatus = currentStatus === 'suspended' ? 'active' : 'suspended';

    const { error } = await supabase
      .from('members')
      .update({ status: newStatus })
      .eq('id', memberId);

    if (error) {
      toast({ title: 'Error updating member', description: error.message, variant: 'destructive' });
      return;
    }

    // Create audit record
    await supabase.from('access_audit').insert([{
      org_id: orgId,
      action: newStatus === 'suspended' ? 'member.suspend' : 'member.activate',
      target: { member_id: memberId } as Record<string, unknown>,
    }]);

    toast({ title: 'Success', description: `Member ${newStatus === 'suspended' ? 'suspended' : 'activated'}` });
    loadMembers();
  };

  const handleUpdateRole = async () => {
    if (!editingRole) return;

    const { error } = await supabase
      .from('role_definitions')
      .update({
        description: editingRole.description,
        approval_limits: editingRole.approval_limits,
        permissions: editingRole.permissions,
      })
      .eq('id', editingRole.id);

    if (error) {
      toast({ title: 'Error updating role', description: error.message, variant: 'destructive' });
      return;
    }

    // Create audit record
    await supabase.from('access_audit').insert([{
      org_id: orgId,
      action: 'role.update',
      target: { role_id: editingRole.id } as Record<string, unknown>,
      after_snapshot: editingRole as unknown as Record<string, unknown>,
    }]);

    toast({ title: 'Success', description: 'Role updated successfully' });
    setEditingRole(null);
    loadRoles();
  };

  const getStatusBadge = (status: MemberStatus) => {
    const variants = {
      active: 'default',
      invited: 'secondary',
      suspended: 'destructive',
      deactivated: 'outline',
    };
    return <Badge variant={variants[status] as "default" | "secondary" | "destructive" | "outline"}>{status}</Badge>;
  };

  const getMemberAssignments = (memberId: string) => {
    return assignments.filter(a => a.member_id === memberId);
  };

  const toolbar = (
    <PageToolbar
      title="Access & Roles"
      primaryAction={{
        label: 'Invite Member',
        icon: Plus,
        onClick: () => setShowInviteDialog(true),
        variant: 'primary',
      }}
    />
  )

  return (
    <PageShell toolbar={toolbar}>
      <div className="p-6 space-y-6">

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
          <TabsTrigger value="assignments">
            <Grid className="w-4 h-4 mr-2" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="pins">
            <Key className="w-4 h-4 mr-2" />
            PINs
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="w-4 h-4 mr-2" />
            Audit
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
              <Select value={memberStatusFilter} onValueChange={setMemberStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Member</DialogTitle>
                  <DialogDescription>Send an invitation to join your organization</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Email Address *</Label>
                    <Input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => { setInviteForm({ ...inviteForm, email: e.target.value }); setInviteErrors(prev => ({ ...prev, email: '' })); }}
                      placeholder="name@example.com"
                      className={inviteErrors.email ? 'border-destructive' : ''}
                    />
                    {inviteErrors.email && <p className="text-sm text-destructive mt-1">{inviteErrors.email}</p>}
                  </div>
                  <div>
                    <Label>Full Name *</Label>
                    <Input
                      value={inviteForm.full_name}
                      onChange={(e) => { setInviteForm({ ...inviteForm, full_name: e.target.value }); setInviteErrors(prev => ({ ...prev, full_name: '' })); }}
                      placeholder="John Smith"
                      className={inviteErrors.full_name ? 'border-destructive' : ''}
                    />
                    {inviteErrors.full_name && <p className="text-sm text-destructive mt-1">{inviteErrors.full_name}</p>}
                  </div>
                  <div>
                    <Label>Role *</Label>
                    <Select value={inviteForm.role_id} onValueChange={(value) => { setInviteForm({ ...inviteForm, role_id: value }); setInviteErrors(prev => ({ ...prev, role_id: '' })); }}>
                      <SelectTrigger className={inviteErrors.role_id ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.filter(r => r.key !== 'Owner').map(role => (
                          <SelectItem key={role.id} value={role.id}>{role.key}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {inviteErrors.role_id && <p className="text-sm text-destructive mt-1">{inviteErrors.role_id}</p>}
                  </div>
                  <div>
                    <Label>Personal Message (Optional)</Label>
                    <Textarea
                      value={inviteForm.message}
                      onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                      placeholder="Optional message to include..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                  <Button onClick={handleInviteMember}>Send Invitation</Button>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No team members yet</p>
                      <p className="text-sm">Invite your first teammate to get started</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map(member => {
                    const memberAssignments = getMemberAssignments(member.id);
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                              {member.full_name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <span className="font-medium">{member.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{member.primary_email}</TableCell>
                        <TableCell>{getStatusBadge(member.status)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {memberAssignments.map(a => (
                              <Badge key={a.id} variant="outline">
                                {a.role_definitions?.key}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleSuspendMember(member.id, member.status)}>
                                {member.status === 'suspended' ? (
                                  <>
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    Activate
                                  </>
                                ) : (
                                  <>
                                    <UserX className="w-4 h-4 mr-2" />
                                    Suspend
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ROLES TAB */}
        <TabsContent value="roles" className="space-y-4">
          <div className="flex gap-6 h-full relative isolate">
            {/* Left: Roles List */}
            <div className="w-80 flex-shrink-0 space-y-2">
              <Card className="p-4">
                <h3 className="font-semibold mb-4">Roles</h3>
                <div className="space-y-2">
                  {roles.map(role => (
                    <div
                      key={role.id}
                      className={`p-4 rounded-lg border bg-card cursor-pointer transition-colors ${
                        selectedRole?.id === role.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                      }`}
                      onClick={() => {
                        setSelectedRole(role);
                        setEditingRole({ ...role });
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{role.key}</div>
                          <div className="text-xs text-muted-foreground truncate">{role.description}</div>
                        </div>
                        <Badge variant={role.is_system ? 'secondary' : 'outline'} className="flex-shrink-0">
                          {role.is_system ? 'System' : 'Custom'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right: Role Editor */}
            <div className="flex-1 min-w-0">
              <Card className="p-6">
                {editingRole ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">{editingRole.key}</h3>
                      {editingRole.is_system && (
                        <div className="w-full mb-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-900 dark:text-blue-100">
                          This is a system role. You can edit approval limits but permissions are locked for safety.
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={editingRole.description || ''}
                        onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                        className="w-full min-h-[100px] p-3 border rounded-md resize-none"
                        rows={3}
                      />
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Approval Limits</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col space-y-2">
                          <Label className="text-sm">Price Change Max %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={editingRole.approval_limits?.price_change_percent || 0}
                            onChange={(e) => setEditingRole({
                              ...editingRole,
                              approval_limits: { ...editingRole.approval_limits, price_change_percent: parseFloat(e.target.value) }
                            })}
                          />
                          <p className="text-xs text-muted-foreground">Max price change without owner approval</p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <Label className="text-sm">PO Amount Limit ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={editingRole.approval_limits?.po_amount || 0}
                            onChange={(e) => setEditingRole({
                              ...editingRole,
                              approval_limits: { ...editingRole.approval_limits, po_amount: parseFloat(e.target.value) }
                            })}
                          />
                          <p className="text-xs text-muted-foreground">Max PO amount without owner approval</p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <Label className="text-sm">Roster Over %</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={editingRole.approval_limits?.roster_over_percent || 0}
                            onChange={(e) => setEditingRole({
                              ...editingRole,
                              approval_limits: { ...editingRole.approval_limits, roster_over_percent: parseFloat(e.target.value) }
                            })}
                          />
                          <p className="text-xs text-muted-foreground">Max roster budget variance</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-3">Permissions Matrix</h4>
                      <div className="border rounded-lg overflow-x-auto">
                        <Table className="w-full">
                          <TableHeader>
                            <TableRow className="bg-muted">
                              <TableHead className="px-4 py-3 text-left font-medium min-w-[200px]">Module</TableHead>
                              {OPERATIONS.map(op => (
                                <TableHead key={op} className="px-4 py-3 text-center font-medium capitalize min-w-[80px]">{op}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {MODULES.map(module => (
                              <TableRow key={module.key}>
                                <TableCell className="px-4 py-2 font-medium">{module.label}</TableCell>
                                {OPERATIONS.map(op => {
                                  const hasPermission = editingRole.permissions?.[module.key]?.[op] || false;
                                  return (
                                    <TableCell key={op} className="px-4 py-2">
                                      <div className="flex items-center justify-center">
                                        <Switch
                                          checked={hasPermission}
                                          disabled={editingRole.is_system}
                                          onCheckedChange={(checked) => {
                                            const newPermissions = { ...editingRole.permissions };
                                            if (!newPermissions[module.key]) {
                                              newPermissions[module.key] = {};
                                            }
                                            newPermissions[module.key][op] = checked;
                                            setEditingRole({ ...editingRole, permissions: newPermissions });
                                          }}
                                        />
                                      </div>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button>
                      <Button onClick={handleUpdateRole}>Save Role</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Select a role to view and edit</p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ASSIGNMENTS TAB */}
        <TabsContent value="assignments" className="space-y-4">
          <Card className="p-6">
            <div className="text-center py-8 text-muted-foreground">
              <Grid className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Assignment management grid coming soon</p>
              <p className="text-sm">View and manage member roles across venues</p>
            </div>
          </Card>
        </TabsContent>

        {/* PINS TAB */}
        <TabsContent value="pins" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-900 dark:text-blue-100">
              4-digit PINs are used for time clock and device access
            </div>
            <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate PIN
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Generate PIN for Member</DialogTitle>
                  <DialogDescription>A random 4-digit PIN will be generated</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Select Member</Label>
                    <Select value={selectedMemberForPin} onValueChange={setSelectedMemberForPin}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose member" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.filter(m => m.status === 'active').map(member => (
                          <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {generatedPin && (
                    <div className="bg-muted rounded-lg p-6 text-center">
                      <p className="text-sm text-muted-foreground mb-2">Generated PIN</p>
                      <p className="text-4xl font-bold tracking-wider">{generatedPin}</p>
                      <p className="text-xs text-muted-foreground mt-4">⚠️ This PIN will not be shown again. Copy it now.</p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowPinDialog(false);
                    setGeneratedPin('');
                    setSelectedMemberForPin('');
                  }}>Cancel</Button>
                  <Button onClick={handleGeneratePin}>
                    <Copy className="w-4 h-4 mr-2" />
                    Generate & Copy
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Last Rotated</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pins.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <Key className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No PINs configured yet</p>
                      <p className="text-sm">Generate PINs to enable time clock access</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  pins.map(pin => (
                    <TableRow key={pin.id}>
                      <TableCell>
                        <div className="font-medium">{pin.members?.full_name}</div>
                        <div className="text-sm text-muted-foreground">{pin.members?.primary_email}</div>
                      </TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded">****</code>
                      </TableCell>
                      <TableCell>{new Date(pin.last_rotated_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={pin.is_active ? 'default' : 'outline'}>
                          {pin.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRotatePin(pin.id, pin.member_id)}
                        >
                          <RotateCw className="w-4 h-4 mr-2" />
                          Rotate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* AUDIT TAB */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={auditDateRange} onValueChange={setAuditDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadAuditRecords}>Refresh</Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No audit records yet</p>
                      <p className="text-sm">Activity will appear here as team members are managed</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  auditRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{new Date(record.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {JSON.stringify(record.target)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </PageShell>
  );
}
