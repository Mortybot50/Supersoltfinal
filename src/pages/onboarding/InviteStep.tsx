import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Building2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    return <div>Invalid invite</div>
  }

  const handleStepComplete = (data: any) => {
    // Update staff data
    updateStaffOnboarding(member.id, data)
    
    // Mark step as completed
    const step = onboardingSteps.find(s => s.staff_id === member.id && s.step_number === currentStep)
    if (step) {
      updateOnboardingStep(step.id, { status: 'completed', completed_at: new Date() })
    }
    
    // Navigate to next step or back to portal
    if (currentStep < ONBOARDING_STEPS.length) {
      navigate(`/onboarding/portal/${token}/step${currentStep + 1}`)
    } else {
      // All steps complete - update status to pending review
      updateStaffOnboarding(member.id, { onboarding_status: 'pending_review' })
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

        {/* Progress */}
        <div className="text-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/onboarding/portal/${token}`)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Overview
          </Button>
          <div className="text-sm text-muted-foreground">
            Step {currentStep} of {ONBOARDING_STEPS.length}: {ONBOARDING_STEPS[currentStep - 1]?.title}
          </div>
        </div>

        {/* Step Content */}
        {renderStep()}
      </div>
    </div>
  )
}
