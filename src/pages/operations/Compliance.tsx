import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CheckCircle, AlertTriangle, XCircle, Clock, Users, FileText, Shield, Send, UserPlus,
} from 'lucide-react'
import { PageShell, PageToolbar, PageSidebar } from '@/components/shared'
import { useDataStore } from '@/lib/store/dataStore'
import { ONBOARDING_STEPS, DOCUMENT_TYPES } from '@/lib/constants/onboarding'
import { format, differenceInDays } from 'date-fns'

const ONBOARDING_STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  invited: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  pending_review: 'bg-orange-100 text-orange-700',
  roster_ready: 'bg-green-100 text-green-700',
}

export default function Compliance() {
  const navigate = useNavigate()
  const { staff, onboardingSteps, onboardingDocuments, onboardingInvites } = useDataStore()

  // Filter staff with onboarding activity
  const allStaff = staff.filter(s => s.status === 'active')

  // Onboarding metrics
  const onboardingMetrics = useMemo(() => {
    const byStatus = {
      not_started: allStaff.filter(s => s.onboarding_status === 'not_started').length,
      invited: allStaff.filter(s => s.onboarding_status === 'invited').length,
      in_progress: allStaff.filter(s => s.onboarding_status === 'in_progress').length,
      pending_review: allStaff.filter(s => s.onboarding_status === 'pending_review').length,
      roster_ready: allStaff.filter(s => s.onboarding_status === 'roster_ready').length,
    }

    const totalActive = allStaff.length
    const completionRate = totalActive > 0
      ? Math.round((byStatus.roster_ready / totalActive) * 100)
      : 0

    return { byStatus, totalActive, completionRate }
  }, [allStaff])

  // Document compliance
  const documentCompliance = useMemo(() => {
    const requiredTypes = DOCUMENT_TYPES.filter(dt => dt.required)
    const issues: { staffId: string; staffName: string; docType: string; status: 'missing' | 'pending' | 'expired' }[] = []

    allStaff.forEach(s => {
      const staffDocs = onboardingDocuments.filter(d => d.staff_id === s.id)
      requiredTypes.forEach(dt => {
        const doc = staffDocs.find(d => d.document_type === dt.value)
        if (!doc) {
          if (s.onboarding_status !== 'not_started' && s.onboarding_status !== 'invited') {
            issues.push({ staffId: s.id, staffName: s.name, docType: dt.label, status: 'missing' })
          }
        } else if (doc.status === 'pending') {
          issues.push({ staffId: s.id, staffName: s.name, docType: dt.label, status: 'pending' })
        }
      })
    })

    const totalRequired = allStaff.filter(s => s.onboarding_status !== 'not_started').length * requiredTypes.length
    const totalProvided = onboardingDocuments.filter(d =>
      requiredTypes.some(rt => rt.value === d.document_type) && d.status === 'approved'
    ).length
    const docComplianceRate = totalRequired > 0 ? Math.round((totalProvided / totalRequired) * 100) : 100

    return { issues, docComplianceRate, totalRequired, totalProvided }
  }, [allStaff, onboardingDocuments])

  // Per-staff onboarding detail
  const staffOnboarding = useMemo(() => {
    return allStaff
      .filter(s => s.onboarding_status !== 'roster_ready')
      .map(s => {
        const steps = onboardingSteps.filter(st => st.staff_id === s.id)
        const completed = steps.filter(st => st.status === 'completed').length
        const invite = onboardingInvites
          .filter(i => i.staff_id === s.id)
          .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0]
        const isExpired = invite ? new Date(invite.expires_at) < new Date() : false
        const daysSinceInvite = invite ? differenceInDays(new Date(), new Date(invite.sent_at)) : null

        return { staff: s, completed, total: ONBOARDING_STEPS.length, invite, isExpired, daysSinceInvite }
      })
      .sort((a, b) => {
        // Pending review first, then in_progress, then invited, then not_started
        const order = { pending_review: 0, in_progress: 1, invited: 2, not_started: 3, roster_ready: 4 }
        return (order[a.staff.onboarding_status] ?? 5) - (order[b.staff.onboarding_status] ?? 5)
      })
  }, [allStaff, onboardingSteps, onboardingInvites])

  // Compliance checklist per staff
  const staffCompliance = useMemo(() => {
    return allStaff
      .filter(s => s.onboarding_status === 'roster_ready' || s.onboarding_status === 'pending_review')
      .map(s => {
        const docs = onboardingDocuments.filter(d => d.staff_id === s.id)
        const hasTFN = !!(s.tfn_number || s.tfn_exemption)
        const hasSuper = !!(s.super_fund_name || s.super_use_employer_default)
        const hasBank = !!(s.bank_bsb && s.bank_account_number)
        const hasID = docs.some(d => d.document_type === 'id_proof' && d.status === 'approved')
        const total = 4
        const complete = [hasTFN, hasSuper, hasBank, hasID].filter(Boolean).length

        return { staff: s, hasTFN, hasSuper, hasBank, hasID, complete, total }
      })
  }, [allStaff, onboardingDocuments])

  const sidebar = (
    <PageSidebar
      title="Compliance"
      metrics={[
        { label: 'Active Staff', value: onboardingMetrics.totalActive },
        { label: 'Completion Rate', value: `${onboardingMetrics.completionRate}%` },
      ]}
      extendedMetrics={[
        { label: 'Roster Ready', value: onboardingMetrics.byStatus.roster_ready, color: 'green' },
        { label: 'Pending Review', value: onboardingMetrics.byStatus.pending_review, color: onboardingMetrics.byStatus.pending_review > 0 ? 'orange' : 'default' },
        { label: 'In Progress', value: onboardingMetrics.byStatus.in_progress },
        { label: 'Invited', value: onboardingMetrics.byStatus.invited },
        { label: 'Not Started', value: onboardingMetrics.byStatus.not_started, color: onboardingMetrics.byStatus.not_started > 0 ? 'red' : 'default' },
      ]}
      quickActions={[
        { label: 'People', icon: Users, onClick: () => navigate('/workforce/people') },
      ]}
      warnings={documentCompliance.issues.length > 0 ? [`${documentCompliance.issues.length} document issues`] : []}
    />
  )

  const toolbar = (
    <PageToolbar
      title="Compliance"
      actions={
        <Button variant="outline" size="sm" className="h-8" onClick={() => navigate('/workforce/people')}>
          <Users className="h-4 w-4 mr-1" />
          People
        </Button>
      }
    />
  )

  return (
    <PageShell sidebar={sidebar} toolbar={toolbar}>
      <div className="p-4 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Staff</p>
            </div>
            <p className="text-2xl font-bold">{onboardingMetrics.totalActive}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-xs text-muted-foreground">Onboarding Complete</p>
            </div>
            <p className="text-2xl font-bold">{onboardingMetrics.byStatus.roster_ready}</p>
            <p className="text-xs text-muted-foreground">{onboardingMetrics.completionRate}% of active</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-orange-500" />
              <p className="text-xs text-muted-foreground">Pending Review</p>
            </div>
            <p className="text-2xl font-bold">{onboardingMetrics.byStatus.pending_review}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Document Compliance</p>
            </div>
            <p className="text-2xl font-bold">{documentCompliance.docComplianceRate}%</p>
            <p className="text-xs text-muted-foreground">{documentCompliance.totalProvided}/{documentCompliance.totalRequired} verified</p>
          </Card>
        </div>

        <Tabs defaultValue="onboarding">
          <TabsList>
            <TabsTrigger value="onboarding">
              Onboarding Status ({staffOnboarding.length})
            </TabsTrigger>
            <TabsTrigger value="documents">
              Document Compliance ({documentCompliance.issues.length})
            </TabsTrigger>
            <TabsTrigger value="checklist">
              Staff Checklist ({staffCompliance.length})
            </TabsTrigger>
          </TabsList>

          {/* Onboarding Status Tab */}
          <TabsContent value="onboarding">
            {staffOnboarding.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <p className="font-medium">All staff onboarding complete</p>
                <p className="text-sm text-muted-foreground mt-1">Everyone is roster-ready</p>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffOnboarding.map(({ staff: s, completed, total, invite, isExpired, daysSinceInvite }) => (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/workforce/people/${s.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                              {s.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{s.name}</p>
                              <p className="text-xs text-muted-foreground">{s.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={ONBOARDING_STATUS_COLORS[s.onboarding_status] || ''}>
                            {isExpired && s.onboarding_status === 'invited'
                              ? 'Expired'
                              : s.onboarding_status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-muted rounded-full h-1.5">
                              <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${(completed / total) * 100}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{completed}/{total}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {invite ? format(new Date(invite.sent_at), 'dd MMM') : '—'}
                        </TableCell>
                        <TableCell>
                          {daysSinceInvite !== null && (
                            <span className={`text-sm ${daysSinceInvite > 5 ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                              {daysSinceInvite}d
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.onboarding_status === 'pending_review' && (
                            <Button size="sm" variant="outline" onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/workforce/people/${s.id}`)
                            }}>
                              Review
                            </Button>
                          )}
                          {s.onboarding_status === 'not_started' && (
                            <Button size="sm" variant="ghost" onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/workforce/people/${s.id}`)
                            }}>
                              <Send className="h-3 w-3 mr-1" />
                              Invite
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Document Compliance Tab */}
          <TabsContent value="documents">
            {documentCompliance.issues.length === 0 ? (
              <Card className="p-8 text-center">
                <Shield className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <p className="font-medium">All documents compliant</p>
                <p className="text-sm text-muted-foreground mt-1">All required documents have been verified</p>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentCompliance.issues.map((issue, i) => (
                      <TableRow key={`${issue.staffId}-${issue.docType}-${i}`}>
                        <TableCell className="font-medium">{issue.staffName}</TableCell>
                        <TableCell>{issue.docType}</TableCell>
                        <TableCell>
                          {issue.status === 'missing' ? (
                            <Badge className="bg-red-100 text-red-700">
                              <XCircle className="h-3 w-3 mr-1" />
                              Missing
                            </Badge>
                          ) : issue.status === 'pending' ? (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending Review
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-700">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Expired
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/workforce/people/${issue.staffId}`)}>
                            View Profile
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          {/* Staff Checklist Tab */}
          <TabsContent value="checklist">
            {staffCompliance.length === 0 ? (
              <Card className="p-8 text-center">
                <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="font-medium">No staff to review</p>
                <p className="text-sm text-muted-foreground mt-1">Staff who complete onboarding will appear here</p>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead className="text-center">ID Proof</TableHead>
                      <TableHead className="text-center">TFN</TableHead>
                      <TableHead className="text-center">Super</TableHead>
                      <TableHead className="text-center">Bank</TableHead>
                      <TableHead className="text-center">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffCompliance.map(({ staff: s, hasID, hasTFN, hasSuper, hasBank, complete, total }) => (
                      <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/workforce/people/${s.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                              {s.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                            <span className="font-medium">{s.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {hasID ? <CheckCircle className="h-5 w-5 text-green-600 mx-auto" /> : <XCircle className="h-5 w-5 text-red-400 mx-auto" />}
                        </TableCell>
                        <TableCell className="text-center">
                          {hasTFN ? <CheckCircle className="h-5 w-5 text-green-600 mx-auto" /> : <XCircle className="h-5 w-5 text-red-400 mx-auto" />}
                        </TableCell>
                        <TableCell className="text-center">
                          {hasSuper ? <CheckCircle className="h-5 w-5 text-green-600 mx-auto" /> : <XCircle className="h-5 w-5 text-red-400 mx-auto" />}
                        </TableCell>
                        <TableCell className="text-center">
                          {hasBank ? <CheckCircle className="h-5 w-5 text-green-600 mx-auto" /> : <XCircle className="h-5 w-5 text-red-400 mx-auto" />}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={complete === total ? 'default' : 'secondary'}>
                            {complete}/{total}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  )
}
