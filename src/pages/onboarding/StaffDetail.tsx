import { useParams, useNavigate, Link } from 'react-router-dom'
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from '@/components/ui/breadcrumb'
import { useDataStore } from '@/lib/store/dataStore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ONBOARDING_STEPS, INVITE_EXPIRY_DAYS } from '@/lib/constants/onboarding'
import { generateSecureToken, generateInviteUrl } from '@/lib/utils/tokenGenerator'
import { 
  CheckCircle, 
  Clock, 
  Circle, 
  Mail, 
  ArrowLeft,
  FileText,
  User,
  AlertCircle,
  Edit,
  Phone,
  Calendar,
  XCircle,
  Send
} from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { OnboardingInvite } from '@/types'
import ContactDetailsStep from './steps/ContactDetailsStep'
import AddressStep from './steps/AddressStep'
import BankDetailsStep from './steps/BankDetailsStep'
import TFNDeclarationStep from './steps/TFNDeclarationStep'
import SuperChoiceStep from './steps/SuperChoiceStep'
import DocumentsStep from './steps/DocumentsStep'
import PoliciesStep from './steps/PoliciesStep'

export default function StaffDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [editingStep, setEditingStep] = useState<number | null>(null)
  const { 
    staff, 
    onboardingInvites, 
    addOnboardingInvite, 
    onboardingSteps,
    updateStaffOnboarding,
    updateOnboardingStep,
    onboardingDocuments
  } = useDataStore()
  
  const member = staff.find(s => s.id === id)
  const steps = onboardingSteps.filter(s => s.staff_id === id)
  const invites = onboardingInvites.filter(i => i.staff_id === id)
  const documents = onboardingDocuments.filter(d => d.staff_id === id)
  
  if (!member) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p>Staff member not found</p>
          <Button onClick={() => navigate('/workforce/people')} className="mt-4">
            Back to People
          </Button>
        </Card>
      </div>
    )
  }
  
  const completedSteps = steps.filter(s => s.status === 'completed').length
  const totalSteps = ONBOARDING_STEPS.length
  const progress = (completedSteps / totalSteps) * 100
  
  const latestInvite = invites.length > 0 ? invites[invites.length - 1] : null
  
  const handleSendInvite = () => {
    const token = generateSecureToken()
    const inviteUrl = generateInviteUrl(token)
    
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + INVITE_EXPIRY_DAYS)
    
    const invite: OnboardingInvite = {
      id: crypto.randomUUID(),
      staff_id: member.id,
      token,
      sent_to_email: member.email,
      sent_at: new Date(),
      expires_at: expiryDate
    }
    
    addOnboardingInvite(invite)
    updateStaffOnboarding(member.id, { onboarding_status: 'invited' })
    
    toast.success(`Onboarding invite sent to ${member.email}`)
    
    navigator.clipboard.writeText(inviteUrl)
    toast.success('Invite link copied to clipboard')
  }
  
  const handleApprove = () => {
    updateStaffOnboarding(member.id, { 
      onboarding_status: 'roster_ready',
      onboarding_completed_at: new Date(),
      onboarding_progress: 100
    })
    
    toast.success(`${member.name} is now roster-ready`)
  }
  
  const getStepIcon = (stepNumber: number) => {
    const step = steps.find(s => s.step_number === stepNumber)
    if (step?.status === 'completed') return <CheckCircle className="w-5 h-5 text-green-600" />
    if (step?.status === 'in_progress') return <Clock className="w-5 h-5 text-yellow-600" />
    return <Circle className="w-5 h-5 text-gray-400" />
  }

  const handleStepComplete = (stepNumber: number, data: Record<string, unknown>) => {
    // Update staff data
    updateStaffOnboarding(member.id, data)
    
    // Mark step as completed
    const step = steps.find(s => s.step_number === stepNumber)
    if (step) {
      updateOnboardingStep(step.id, { status: 'completed', completed_at: new Date() })
    }
    
    setEditingStep(null)
    
    toast.success('Onboarding information has been saved')
  }

  const renderEditableStep = (stepNumber: number) => {
    const commonProps = {
      staffId: member.id,
      initialData: member,
      onComplete: (data: Record<string, unknown>) => handleStepComplete(stepNumber, data),
      onBack: () => setEditingStep(null)
    }

    switch (stepNumber) {
      case 1:
        return <ContactDetailsStep {...commonProps} />
      case 2:
        return <AddressStep {...commonProps} />
      case 3:
        return <BankDetailsStep {...commonProps} />
      case 4:
        return <TFNDeclarationStep {...commonProps} />
      case 5:
        return <SuperChoiceStep {...commonProps} />
      case 6:
        return <DocumentsStep {...commonProps} onComplete={() => handleStepComplete(stepNumber, {})} />
      case 7:
        return <PoliciesStep {...commonProps} onComplete={() => handleStepComplete(stepNumber, {})} />
      default:
        return null
    }
  }
  
  return (
    <div className="p-4 md:p-6 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink asChild><Link to="/workforce/people">People</Link></BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{member.first_name} {member.last_name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      <Card className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-lg font-semibold mb-2">{member.name}</h1>
            <p className="text-muted-foreground mb-3">Staff Profile & Onboarding</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {member.email}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                {member.phone}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Start: {member.start_date ? new Date(member.start_date).toLocaleDateString() : 'Not set'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={
              member.onboarding_status === 'roster_ready' ? 'default' :
              member.onboarding_status === 'pending_review' ? 'secondary' :
              member.onboarding_status === 'in_progress' || member.onboarding_status === 'invited' ? 'outline' :
              'destructive'
            }>
              {member.onboarding_status.replace(/_/g, ' ').toUpperCase()}
            </Badge>
          </div>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">Progress:</span>
            <span className="text-sm text-muted-foreground">{completedSteps} of {totalSteps} steps completed</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        <div className="flex gap-2">
          {member.onboarding_status === 'not_started' && (
            <Button onClick={handleSendInvite}>
              <Send className="w-4 h-4 mr-2" />
              Send Onboarding Invite
            </Button>
          )}
          
          {member.onboarding_status === 'invited' && (
            <Button onClick={handleSendInvite} variant="outline">
              <Send className="w-4 h-4 mr-2" />
              Resend Invite
            </Button>
          )}
          
          {member.onboarding_status === 'pending_review' && (
            <Button onClick={handleApprove}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve Onboarding
            </Button>
          )}
          
          {latestInvite && (
            <Button 
              variant="outline"
              onClick={() => {
                const url = generateInviteUrl(latestInvite.token)
                navigator.clipboard.writeText(url)
                toast.success('Invite link copied to clipboard')
              }}
            >
              Copy Invite Link
            </Button>
          )}
        </div>
      </Card>
      
      <Tabs defaultValue="onboarding">
        <TabsList>
          <TabsTrigger value="onboarding">Onboarding Steps</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="onboarding">
          {editingStep ? (
            <div className="space-y-4">
              {renderEditableStep(editingStep)}
            </div>
          ) : (
            <div className="space-y-4">
              {ONBOARDING_STEPS.map(step => {
                const stepData = steps.find(s => s.step_number === step.number)
                return (
                  <Card key={step.number} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStepIcon(step.number)}
                        <div>
                          <div className="font-medium">{step.title}</div>
                          <div className="text-sm text-muted-foreground">{step.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={stepData?.status === 'completed' ? 'default' : 'outline'}>
                          {stepData?.status === 'completed' ? 'Completed' : 'Pending'}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingStep(step.number)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          {stepData?.status === 'completed' ? 'Edit' : 'Complete'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="overview" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Employment Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Role</div>
                <div className="font-medium capitalize">{member.role}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Employment Type</div>
                <div className="font-medium capitalize">{member.employment_type?.replace('-', ' ')}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Hourly Rate</div>
                <div className="font-medium">${(member.hourly_rate / 100).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Award Classification</div>
                <div className="font-medium">{member.award_classification || 'Not set'}</div>
              </div>
            </div>
          </Card>
          
          {latestInvite && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Invite Status</h2>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Sent: </span>
                  <span className="font-medium">{new Date(latestInvite.sent_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Expires: </span>
                  <span className="font-medium">{new Date(latestInvite.expires_at).toLocaleString()}</span>
                </div>
                {latestInvite.accessed_at && (
                  <div>
                    <span className="text-sm text-muted-foreground">First accessed: </span>
                    <span className="font-medium">{new Date(latestInvite.accessed_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="documents" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Uploaded Documents</h2>
            {documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5" />
                      <div>
                        <div className="font-medium">{doc.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {doc.document_type.replace(/_/g, ' ')} • {new Date(doc.uploaded_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge variant={
                      doc.status === 'approved' ? 'default' :
                      doc.status === 'rejected' ? 'destructive' :
                      'secondary'
                    }>
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="compliance" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Compliance Checklist</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded">
                <div>Identity Verification</div>
                <Badge variant={documents.some(d => d.document_type === 'id_proof' && d.status === 'approved') ? 'default' : 'secondary'}>
                  {documents.some(d => d.document_type === 'id_proof' && d.status === 'approved') ? 'Verified' : 'Pending'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded">
                <div>TFN Declaration</div>
                <Badge variant={member.tfn_number || member.tfn_exemption ? 'default' : 'secondary'}>
                  {member.tfn_number || member.tfn_exemption ? 'Complete' : 'Pending'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded">
                <div>Super Choice</div>
                <Badge variant={member.super_fund_name || member.super_use_employer_default ? 'default' : 'secondary'}>
                  {member.super_fund_name || member.super_use_employer_default ? 'Complete' : 'Pending'}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded">
                <div>Bank Details</div>
                <Badge variant={member.bank_bsb && member.bank_account_number ? 'default' : 'secondary'}>
                  {member.bank_bsb && member.bank_account_number ? 'Complete' : 'Pending'}
                </Badge>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
