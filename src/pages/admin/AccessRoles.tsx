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
import { Plus, Search, MoreVertical, Users, Shield, Grid, Key, FileText, UserX, UserCheck } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isValidEmail } from '@/lib/utils/validation';
import { PageShell, PageToolbar } from '@/components/shared';

// Types based on org_members + profiles (the tables that actually exist)
interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'supervisor' | 'crew';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export default function AccessRoles() {
  const { toast } = useToast();
  const { currentOrg } = useAuth();
  const [activeTab, setActiveTab] = useState('members');
  const orgId = currentOrg?.id || '';

  // Members state (from org_members + profiles)
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<OrgMember[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<string>('all');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'crew' as 'manager' | 'supervisor' | 'crew',
  });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});

  // Load data when org is available
  useEffect(() => {
    if (!orgId) return;
    loadMembers();
  }, [orgId]);

  useEffect(() => {
    filterMembers();
  }, [members, memberSearch, memberStatusFilter]);

  const loadMembers = async () => {
    const { data, error } = await supabase
      .from('org_members')
      .select('*, profiles(email, first_name, last_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading members', description: error.message, variant: 'destructive' });
    } else {
      setMembers((data || []) as OrgMember[]);
    }
  };

  const filterMembers = () => {
    let filtered = members;

    if (memberSearch) {
      filtered = filtered.filter(m => {
        const name = `${m.profiles?.first_name || ''} ${m.profiles?.last_name || ''}`.toLowerCase();
        const email = (m.profiles?.email || '').toLowerCase();
        return name.includes(memberSearch.toLowerCase()) || email.includes(memberSearch.toLowerCase());
      });
    }

    if (memberStatusFilter !== 'all') {
      if (memberStatusFilter === 'active') {
        filtered = filtered.filter(m => m.is_active);
      } else if (memberStatusFilter === 'inactive') {
        filtered = filtered.filter(m => !m.is_active);
      }
    }

    setFilteredMembers(filtered);
  };

  const getMemberName = (m: OrgMember) => {
    const first = m.profiles?.first_name || '';
    const last = m.profiles?.last_name || '';
    return `${first} ${last}`.trim() || m.profiles?.email || 'Unknown';
  };

  const getMemberInitials = (m: OrgMember) => {
    const first = m.profiles?.first_name || '';
    const last = m.profiles?.last_name || '';
    if (first && last) return `${first[0]}${last[0]}`;
    if (first) return first[0];
    return (m.profiles?.email || 'U')[0].toUpperCase();
  };

  const handleInviteMember = async () => {
    const errors: Record<string, string> = {};
    if (!inviteForm.full_name.trim()) errors.full_name = 'Full name is required';
    if (!inviteForm.email.trim()) {
      errors.email = 'Email is required';
    } else if (!isValidEmail(inviteForm.email)) {
      errors.email = 'Enter a valid email address';
    }
    if (Object.keys(errors).length > 0) {
      setInviteErrors(errors);
      return;
    }
    setInviteErrors({});

    // For now, show a message that full invite flow requires Supabase Edge Functions
    toast({
      title: 'Invite flow coming soon',
      description: `Team member invitations require email sending (Supabase Edge Function). For now, ask ${inviteForm.email} to sign up directly.`,
    });
    setShowInviteDialog(false);
    setInviteForm({ email: '', full_name: '', role: 'crew' });
    setInviteErrors({});
  };

  const handleToggleActive = async (memberId: string, currentlyActive: boolean) => {
    const { error } = await supabase
      .from('org_members')
      .update({ is_active: !currentlyActive })
      .eq('id', memberId);

    if (error) {
      toast({ title: 'Error updating member', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: `Member ${currentlyActive ? 'deactivated' : 'activated'}` });
    loadMembers();
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from('org_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) {
      toast({ title: 'Error updating role', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Success', description: `Role updated to ${newRole}` });
    loadMembers();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'manager': return 'secondary';
      case 'supervisor': return 'outline';
      default: return 'outline';
    }
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
                  <SelectItem value="inactive">Inactive</SelectItem>
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
                    <Select value={inviteForm.role} onValueChange={(value: 'manager' | 'supervisor' | 'crew') => setInviteForm({ ...inviteForm, role: value })}>
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
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
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
                  filteredMembers.map(member => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {getMemberInitials(member)}
                          </div>
                          <span className="font-medium">{getMemberName(member)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{member.profiles?.email || '—'}</TableCell>
                      <TableCell>
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleChangeRole(member.id, value)}
                          disabled={member.role === 'owner'}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <Badge variant={getRoleBadgeVariant(member.role) as "default" | "secondary" | "outline"} className="capitalize">
                              {member.role}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="crew">Crew</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.is_active ? 'default' : 'outline'}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {member.role !== 'owner' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleToggleActive(member.id, member.is_active)}>
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
          <Card className="p-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Role Hierarchy</h3>
              <p className="text-sm text-muted-foreground">
                Roles control what each team member can see and do. Change a member's role from the Members tab.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { role: 'Owner', desc: 'Full access to all settings, billing, and data. Can manage other owners.', color: 'bg-purple-100 dark:bg-purple-950 border-purple-200 dark:border-purple-800' },
                  { role: 'Manager', desc: 'Can manage inventory, recipes, rosters, and reporting. Cannot access billing or org settings.', color: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' },
                  { role: 'Supervisor', desc: 'Can view reports, manage day-to-day operations, approve timesheets. Limited settings access.', color: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' },
                  { role: 'Crew', desc: 'Can clock in/out, view their roster, and submit availability. Read-only for most features.', color: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700' },
                ].map(r => (
                  <Card key={r.role} className={`p-4 ${r.color}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4" />
                      <h4 className="font-semibold">{r.role}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.desc}</p>
                  </Card>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </PageShell>
  );
}
