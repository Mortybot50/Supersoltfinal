import { useParams, useNavigate } from 'react-router-dom'
import { Building2, ArrowLeft, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useDataStore } from '@/lib/store/dataStore'
import { ONBOARDING_STEPS } from '@/lib/constants/onboarding'
import ContactDetailsStep from './steps/ContactDetailsStep'
import AddressStep from './steps/AddressStep'
import BankDetailsStep from './steps/BankDetailsStep'
import TFNDeclarationStep from './steps/TFNDeclarationStep'
import SuperChoiceStep from './steps/SuperChoiceStep'
import DocumentsStep from './steps/DocumentsStep'
import PoliciesStep from './steps/PoliciesStep'

export default function InviteStep() {
  const { token, stepNumber } = useParams()
  const navigate = useNavigate()
  const { updateStaffOnboarding, onboardingInvites, staff, updateOnboardingStep, onboardingSteps } = useDataStore()

  const invite = onboardingInvites.find(i => i.token === token)
  const member = staff.find(s => s.id === invite?.staff_id)
  const currentStep = parseInt(stepNumber || '1')

  if (!invite || !member) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Invite</h1>
          <p className="text-muted-foreground">This link is invalid. Please contact your manager.</p>
        </Card>
      </div>
    )
  }

  const memberSteps = onboardingSteps.filter(s => s.staff_id === member.id)
  const completedCount = memberSteps.filter(s => s.status === 'completed').length
  const progressPct = (completedCount / ONBOARDING_STEPS.length) * 100

  const handleStepComplete = (data: Record<string, unknown>) => {
    // Update staff data
    updateStaffOnboarding(member.id, data)

    // Mark step as completed
    const step = memberSteps.find(s => s.step_number === currentStep)
    if (step) {
      updateOnboardingStep(step.id, { status: 'completed', completed_at: new Date() })
    }

    // Update progress percentage
    const newCompleted = completedCount + (step?.status !== 'completed' ? 1 : 0)
    const newProgress = Math.round((newCompleted / ONBOARDING_STEPS.length) * 100)
    updateStaffOnboarding(member.id, { onboarding_progress: newProgress })

    // Navigate to next step or back to portal
    if (currentStep < ONBOARDING_STEPS.length) {
      navigate(`/onboarding/portal/${token}/step${currentStep + 1}`)
    } else {
      // All steps complete - update status to pending review
      updateStaffOnboarding(member.id, {
        onboarding_status: 'pending_review',
        onboarding_progress: 100,
      })
      navigate(`/onboarding/portal/${token}`)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      navigate(`/onboarding/portal/${token}/step${currentStep - 1}`)
    } else {
      navigate(`/onboarding/portal/${token}`)
    }
  }

  // Step 8: Review & Submit
  const renderReviewStep = () => (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Review & Submit</h2>
      <p className="text-muted-foreground mb-6">
        Please review your information below before submitting.
      </p>

      <div className="space-y-4">
        {/* Contact */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Contact Details</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Name:</span> {member.name}</div>
            <div><span className="text-muted-foreground">Email:</span> {member.email}</div>
            <div><span className="text-muted-foreground">Phone:</span> {member.phone || '—'}</div>
            <div><span className="text-muted-foreground">Emergency:</span> {member.emergency_contact_name || '—'}</div>
          </div>
        </div>

        {/* Address */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Address</h3>
          <p className="text-sm">
            {member.address_line1 ? (
              <>{member.address_line1}{member.address_line2 ? `, ${member.address_line2}` : ''}, {member.suburb} {member.state} {member.postcode}</>
            ) : (
              <span className="text-muted-foreground">Not provided</span>
            )}
          </p>
        </div>

        {/* Bank */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Bank Details</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Account:</span> {member.bank_account_name || '—'}</div>
            <div><span className="text-muted-foreground">BSB:</span> {member.bank_bsb || '—'}</div>
            <div><span className="text-muted-foreground">Account #:</span> {member.bank_account_number ? '****' + member.bank_account_number.slice(-4) : '—'}</div>
            <div><span className="text-muted-foreground">Bank:</span> {member.bank_institution_name || '—'}</div>
          </div>
        </div>

        {/* TFN */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Tax File Number</h3>
          <div className="text-sm">
            {member.tfn_number ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>TFN provided (***{member.tfn_number.slice(-3)})</span>
              </div>
            ) : member.tfn_exemption ? (
              <span>Exemption claimed</span>
            ) : (
              <span className="text-muted-foreground">Not provided</span>
            )}
          </div>
        </div>

        {/* Super */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Superannuation</h3>
          <div className="text-sm">
            {member.super_fund_name ? (
              <div><span className="text-muted-foreground">Fund:</span> {member.super_fund_name}</div>
            ) : member.super_use_employer_default ? (
              <span>Using employer default fund</span>
            ) : (
              <span className="text-muted-foreground">Not provided</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-6 border-t mt-6">
        <Button type="button" variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={() => handleStepComplete({})}>
          Submit Onboarding
        </Button>
      </div>
    </Card>
  )

  const renderStep = () => {
    const commonProps = {
      staffId: member.id,
      initialData: member,
      onComplete: handleStepComplete,
      onBack: handleBack
    }

    switch (currentStep) {
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
        return <DocumentsStep {...commonProps} onComplete={() => handleStepComplete({})} />
      case 7:
        return <PoliciesStep {...commonProps} onComplete={() => handleStepComplete({})} />
      case 8:
        return renderReviewStep()
      default:
        return <div>Invalid step</div>
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">SuperSolt</h1>
          </div>
          <p className="text-muted-foreground">Staff Onboarding</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/onboarding/portal/${token}`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Overview
            </Button>
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of {ONBOARDING_STEPS.length}: {ONBOARDING_STEPS[currentStep - 1]?.title}
            </span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Step Content */}
        {renderStep()}
      </div>
    </div>
  )
}
