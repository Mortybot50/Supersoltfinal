import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { useDataStore } from '@/lib/store/dataStore'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbSeparator, BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  User, Mail, Phone, MapPin, Calendar, AlertCircle, FileText,
  Clock, DollarSign, Shield, ChevronRight, Plus, ExternalLink,
  CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils/formatters'
import { ONBOARDING_STEPS } from '@/lib/constants/onboarding'
import { updateStaffInDB } from '@/lib/services/labourService'
import { Staff } from '@/types'

// ─── Local Types ────────────────────────────────────────────────────────────

interface QualificationType {
  id: string
  org_id: string
  name: string
  description?: string
  validity_months?: number
  required_for_roles: string[]
}

interface StaffQualification {
  id: string
  org_id: string
  staff_id: string
  qualification_type_id: string
  issue_date?: string
  expiry_date?: string
  certificate_number?: string
  evidence_url?: string
  status: 'valid' | 'expiring' | 'expired'
  qualification_types?: { name: string; validity_months?: number }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TABS = [
  { value: 'personal',    label: 'Personal' },
  { value: 'pay',         label: 'Pay Conditions' },
  { value: 'attendance',  label: 'Time & Attendance' },
  { value: 'leave',       label: 'Leave & Availability' },
  { value: 'hr',          label: 'HR & Compliance' },
]

function computeQualStatus(expiry?: string): 'valid' | 'expiring' | 'expired' {
  if (!expiry) return 'valid'
  const exp = new Date(expiry)
  const now = new Date()
  const thirtyDays = new Date()
  thirtyDays.setDate(thirtyDays.getDate() + 30)
  if (exp < now) return 'expired'
  if (exp <= thirtyDays) return 'expiring'
  return 'valid'
}

function QualStatusBadge({ status }: { status: 'valid' | 'expiring' | 'expired' }) {
  if (status === 'valid')    return <Badge className="bg-green-100 text-green-800 border-green-200">Valid</Badge>
  if (status === 'expiring') return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Expiring</Badge>
  return <Badge variant="destructive">Expired</Badge>
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-medium">{value || <span className="text-muted-foreground italic">Not set</span>}</div>
    </div>
  )
}

// ─── Assign Qual Dialog ──────────────────────────────────────────────────────

interface AssignQualDialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  staffId: string
  orgId: string
  qualTypes: QualificationType[]
  existing: StaffQualification[]
  onSaved: (q: StaffQualification) => void
}

function AssignQualDialog({ open, onOpenChange, staffId, orgId, qualTypes, existing, onSaved }: AssignQualDialogProps) {
  const [typeId, setTypeId] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [certNumber, setCertNumber] = useState('')
  const [saving, setSaving] = useState(false)

  const availableTypes = qualTypes.filter(t => !existing.some(e => e.qualification_type_id === t.id))
  const selectedType = qualTypes.find(t => t.id === typeId)

  // Auto-fill expiry based on validity_months + issue_date
  useEffect(() => {
    if (issueDate && selectedType?.validity_months) {
      const d = new Date(issueDate)
      d.setMonth(d.getMonth() + selectedType.validity_months)
      setExpiryDate(d.toISOString().split('T')[0])
    }
  }, [issueDate, selectedType])

  const handleSave = async () => {
    if (!typeId) { toast.error('Select a qualification type'); return }
    setSaving(true)
    const status = computeQualStatus(expiryDate || undefined)
    const { data, error } = await supabase
      .from('staff_qualifications')
      .insert({
        org_id: orgId,
        staff_id: staffId,
        qualification_type_id: typeId,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        certificate_number: certNumber || null,
        status,
      })
      .select()
      .single()
    setSaving(false)
    if (error) { toast.error('Failed to save qualification'); return }
    onSaved(data as StaffQualification)
    toast.success('Qualification added')
    onOpenChange(false)
    setTypeId(''); setIssueDate(''); setExpiryDate(''); setCertNumber('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Qualification</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Qualification Type *</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {availableTypes.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Issue Date</Label>
              <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Certificate Number</Label>
            <Input value={certNumber} onChange={e => setCertNumber(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const activeTab = searchParams.get('tab') || 'personal'

  const { staff, onboardingSteps, onboardingDocuments, updateStaff } = useDataStore()
  const { currentOrg } = useAuth()

  const member = staff.find(s => s.id === id)
  const steps = onboardingSteps.filter(s => s.staff_id === id)
  const documents = onboardingDocuments.filter(d => d.staff_id === id)

  // Qualifications state
  const [qualTypes, setQualTypes]   = useState<QualificationType[]>([])
  const [staffQuals, setStaffQuals] = useState<StaffQualification[]>([])
  const [assignOpen, setAssignOpen]  = useState(false)

  const loadQuals = useCallback(async () => {
    if (!currentOrg?.id || !id) return
    const [{ data: types }, { data: quals }] = await Promise.all([
      supabase.from('qualification_types').select('*').eq('org_id', currentOrg.id),
      supabase.from('staff_qualifications').select('*, qualification_types(name, validity_months)').eq('staff_id', id),
    ])
    if (types) setQualTypes(types as QualificationType[])
    if (quals) {
      // Recompute status at render time
      setStaffQuals((quals as StaffQualification[]).map(q => ({
        ...q,
        status: computeQualStatus(q.expiry_date),
      })))
    }
  }, [currentOrg?.id, id])

  useEffect(() => { loadQuals() }, [loadQuals])

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab }, { replace: true })
  }

  const handleQualAdded = (q: StaffQualification) => {
    setStaffQuals(prev => [...prev, { ...q, status: computeQualStatus(q.expiry_date) }])
  }

  const handleRemoveQual = async (qualId: string) => {
    const { error } = await supabase.from('staff_qualifications').delete().eq('id', qualId)
    if (error) { toast.error('Failed to remove qualification'); return }
    setStaffQuals(prev => prev.filter(q => q.id !== qualId))
    toast.success('Qualification removed')
  }

  // Inline field edit helpers
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (member) setNotes((member as Staff & { manager_notes?: string }).manager_notes ?? '')
  }, [member])

  if (!member) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center space-y-4">
          <p className="text-muted-foreground">Staff member not found.</p>
          <Button onClick={() => navigate('/workforce/people')}>Back to People</Button>
        </Card>
      </div>
    )
  }

  const completedSteps = steps.filter(s => s.status === 'completed').length
  const onboardingProgress = ONBOARDING_STEPS.length > 0
    ? Math.round((completedSteps / ONBOARDING_STEPS.length) * 100)
    : member.onboarding_progress

  // ── Tab content ────────────────────────────────────────────────────────────

  const PersonalTab = () => (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><User className="h-4 w-4" /> Personal Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoRow label="Full Name" value={member.name} />
          <InfoRow label="Email" value={member.email} />
          <InfoRow label="Phone" value={member.phone} />
          <InfoRow label="Date of Birth"
            value={member.date_of_birth ? format(new Date(member.date_of_birth), 'dd MMM yyyy') : undefined} />
          <InfoRow label="Employment Start"
            value={member.start_date ? format(new Date(member.start_date), 'dd MMM yyyy') : undefined} />
          <InfoRow label="Role" value={member.role ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : undefined} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><MapPin className="h-4 w-4" /> Address</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoRow label="Street Address" value={member.address_line1} />
          <InfoRow label="Address Line 2" value={member.address_line2} />
          <InfoRow label="Suburb" value={member.suburb} />
          <InfoRow label="State" value={member.state} />
          <InfoRow label="Postcode" value={member.postcode} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Emergency Contact</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoRow label="Name" value={member.emergency_contact_name} />
          <InfoRow label="Phone" value={member.emergency_contact_phone} />
          <InfoRow label="Relationship" value={member.emergency_contact_relationship} />
        </div>
      </Card>
    </div>
  )

  const PayTab = () => (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Pay Conditions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoRow label="Base Hourly Rate" value={`${formatCurrency(member.hourly_rate)}/hr`} />
          <InfoRow label="Employment Type"
            value={member.employment_type?.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())} />
          <InfoRow label="Award Classification" value={member.award_classification} />
          <InfoRow label="Pay Cycle" value="Fortnightly" />
          <InfoRow label="External Payroll ID" value={member.external_payroll_id} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Superannuation</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoRow label="Fund Name" value={member.super_fund_name} />
          <InfoRow label="Fund ABN" value={member.super_fund_abn} />
          <InfoRow label="USI" value={member.super_fund_usi} />
          <InfoRow label="Member Number" value={member.super_member_number} />
          <InfoRow label="Using Employer Default" value={member.super_use_employer_default ? 'Yes' : 'No'} />
        </div>
      </Card>
    </div>
  )

  const AttendanceTab = () => (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock className="h-4 w-4" /> Time & Attendance Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoRow label="Clock-In Method" value="App / PIN" />
          <InfoRow label="Break Rules" value="Per Fair Work award" />
          <InfoRow label="Overtime Threshold" value="38h / week" />
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Timesheets</h3>
          <Button variant="outline" size="sm" asChild>
            <Link to="/workforce/timesheets">
              View Timesheets <ExternalLink className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          View and manage this staff member's timesheet entries on the Timesheets page.
        </p>
      </Card>
    </div>
  )

  const LeaveTab = () => (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Leave Balances</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Annual Leave', value: '—' },
            { label: 'Personal / Carer\'s', value: '—' },
            { label: 'Long Service', value: '—' },
            { label: 'Compassionate', value: '—' },
          ].map(item => (
            <div key={item.label} className="rounded-lg border p-3 text-center">
              <div className="text-2xl font-bold text-primary">{item.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Leave balances are calculated from your payroll system.
          Connect a payroll integration to display live data.
        </p>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Weekly Availability Pattern</h3>
        <div className="grid grid-cols-7 gap-1">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => (
            <div key={day} className="text-center">
              <div className="text-xs text-muted-foreground mb-1">{day}</div>
              <div className="h-8 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Availability is set by the staff member during onboarding.
        </p>
      </Card>
    </div>
  )

  const HRTab = () => {
    const expiredQuals = staffQuals.filter(q => q.status === 'expired').length
    const expiringQuals = staffQuals.filter(q => q.status === 'expiring').length

    return (
      <div className="space-y-4">
        {/* Onboarding Checklist */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Onboarding Checklist</h3>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/workforce/people/${member.id}`}>
                Manage Onboarding <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-muted-foreground">
              {completedSteps} of {ONBOARDING_STEPS.length} steps completed
            </span>
            <Badge variant={member.onboarding_status === 'roster_ready' ? 'default' : 'outline'} className="capitalize">
              {member.onboarding_status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <Progress value={onboardingProgress} className="h-2" />
          <div className="mt-3 space-y-1">
            {ONBOARDING_STEPS.map(step => {
              const stepData = steps.find(s => s.step_number === step.number)
              const done = stepData?.status === 'completed'
              return (
                <div key={step.number} className="flex items-center gap-2 text-sm">
                  {done
                    ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                    : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{step.title}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Qualifications */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" /> Qualifications
                {(expiredQuals > 0 || expiringQuals > 0) && (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
              </h3>
              {expiredQuals > 0 && (
                <p className="text-xs text-destructive mt-0.5">{expiredQuals} expired</p>
              )}
              {expiringQuals > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">{expiringQuals} expiring soon</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/workforce/qualifications">
                  Manage <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
              <Button size="sm" onClick={() => setAssignOpen(true)}>
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
          </div>

          {staffQuals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No qualifications recorded. Click Add to assign one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Qualification</TableHead>
                  <TableHead>Cert #</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffQuals.map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">
                      {q.qualification_types?.name ?? qualTypes.find(t => t.id === q.qualification_type_id)?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{q.certificate_number ?? '—'}</TableCell>
                    <TableCell className="text-sm">
                      {q.issue_date ? format(new Date(q.issue_date), 'dd MMM yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {q.expiry_date ? format(new Date(q.expiry_date), 'dd MMM yyyy') : 'No expiry'}
                    </TableCell>
                    <TableCell><QualStatusBadge status={q.status} /></TableCell>
                    <TableCell>
                      <Button
                        variant="ghost" size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveQual(q.id)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Documents */}
        <Card className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" /> Uploaded Documents</h3>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">{doc.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {doc.document_type.replace(/_/g, ' ')} • {format(new Date(doc.uploaded_at), 'dd MMM yyyy')}
                      </div>
                    </div>
                  </div>
                  <Badge variant={
                    doc.status === 'approved' ? 'default' :
                    doc.status === 'rejected' ? 'destructive' : 'secondary'
                  }>
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Manager Notes */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Manager Notes</h3>
            {!editingNotes && (
              <Button variant="outline" size="sm" onClick={() => setEditingNotes(true)}>Edit</Button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add internal notes about this staff member…"
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)}>Cancel</Button>
                <Button size="sm" onClick={async () => {
                  const success = await updateStaffInDB(member.id, { manager_notes: notes } as Partial<Staff>)
                  if (success) {
                    updateStaff(member.id, { manager_notes: notes } as Partial<Staff>)
                    toast.success('Notes saved')
                  } else {
                    toast.error('Failed to save notes')
                  }
                  setEditingNotes(false)
                }}>Save</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {notes || <span className="italic">No notes yet.</span>}
            </p>
          )}
        </Card>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="p-4 md:p-6 space-y-5">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/workforce/people">People</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{member.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header card */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold shrink-0">
            {getInitials(member.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">{member.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="outline" className="capitalize">{member.role}</Badge>
              {member.employment_type && (
                <Badge variant="secondary" className="capitalize">
                  {member.employment_type.replace('-', ' ')}
                </Badge>
              )}
              <Badge variant={member.status === 'active' ? 'default' : 'destructive'}>
                {member.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {member.email}</span>
              {member.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {member.phone}</span>}
              {member.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Since {format(new Date(member.start_date), 'MMM yyyy')}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold">{formatCurrency(member.hourly_rate)}<span className="text-sm font-normal text-muted-foreground">/hr</span></div>
          </div>
        </div>
      </Card>

      {/* Mobile tab selector */}
      <div className="block md:hidden">
        <Select value={activeTab} onValueChange={handleTabChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TABS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="hidden md:flex mb-2">
          {TABS.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="personal"><PersonalTab /></TabsContent>
        <TabsContent value="pay"><PayTab /></TabsContent>
        <TabsContent value="attendance"><AttendanceTab /></TabsContent>
        <TabsContent value="leave"><LeaveTab /></TabsContent>
        <TabsContent value="hr"><HRTab /></TabsContent>
      </Tabs>

      <AssignQualDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        staffId={member.id}
        orgId={currentOrg?.id ?? ''}
        qualTypes={qualTypes}
        existing={staffQuals}
        onSaved={handleQualAdded}
      />
    </div>
  )
}
