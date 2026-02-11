import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ONBOARDING_STEPS } from '@/lib/constants/onboarding'
import { CheckCircle, Clock, Circle, Building2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useDataStore } from '@/lib/store/dataStore'
import { isTokenExpired } from '@/lib/utils/tokenGenerator'

export default function InvitePortal() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { onboardingInvites, staff, onboardingSteps, updateStaffOnboarding } = useDataStore()

  // Look up invite by token
  const invite = useMemo(() => onboardingInvites.find(i => i.token === token), [onboardingInvites, token])
  const member = useMemo(() => invite ? staff.find(s => s.id === invite.staff_id) : null, [staff, invite])
  const steps = useMemo(() => member ? onboardingSteps.filter(s => s.staff_id === member.id) : [], [onboardingSteps, member])

  const isValid = !!invite && !!member
  const isExpired = invite ? isTokenExpired(invite.expires_at) : false

  // Mark as in_progress on first visit
  useEffect(() => {
    if (invite && member && member.onboarding_status === 'invited') {
      updateStaffOnboarding(member.id, { onboarding_status: 'in_progress' })
    }
  }, [invite, member])

  if (!token || !isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Invite</h1>
          <p className="text-muted-foreground mb-6">
            This onboarding invite link is invalid or has been used.
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact your manager for a new invite link.
          </p>
        </Card>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Invite Expired</h1>
          <p className="text-muted-foreground mb-6">
            This onboarding invite has expired. Please contact your manager for a new invite link.
          </p>
        </Card>
      </div>
    )
  }

  const completedSteps = steps.filter(s => s.status === 'completed').length
  const totalSteps = ONBOARDING_STEPS.length
  const progress = (completedSteps / totalSteps) * 100

  const currentStepNumber = completedSteps + 1
  const currentStep = ONBOARDING_STEPS.find(s => s.number === currentStepNumber)

  const allComplete = completedSteps >= totalSteps
  const isPendingReview = member.onboarding_status === 'pending_review'
  const isRosterReady = member.onboarding_status === 'roster_ready'

  const getStepIcon = (stepNumber: number) => {
    const step = steps.find(s => s.step_number === stepNumber)
    if (step?.status === 'completed') return <CheckCircle className="w-6 h-6 text-green-600" />
    if (stepNumber === currentStepNumber && !allComplete) return <Clock className="w-6 h-6 text-yellow-600" />
    return <Circle className="w-6 h-6 text-gray-400" />
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">SuperSolt</h1>
          </div>
          <p className="text-muted-foreground">Staff Onboarding Portal</p>
        </div>

        <Card className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
            <p className="text-lg text-muted-foreground">Hi {member.name}, let's get you onboarded</p>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Your Progress</span>
              <span className="text-sm text-muted-foreground">{completedSteps} of {totalSteps} completed</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {ONBOARDING_STEPS.map(step => (
              <div
                key={step.number}
                className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                  step.number === currentStepNumber && !allComplete ? 'border-primary bg-primary/5' : ''
                } ${steps.find(s => s.step_number === step.number)?.status === 'completed' ? 'bg-green-50 border-green-200' : ''}`}
                onClick={() => {
                  const stepData = steps.find(s => s.step_number === step.number)
                  if (stepData?.status === 'completed' || step.number === currentStepNumber) {
                    navigate(`/onboarding/portal/${token}/step${step.number}`)
                  }
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getStepIcon(step.number)}
                  <span className="text-sm font-medium">Step {step.number}</span>
                </div>
                <div className="text-sm font-medium">{step.title}</div>
                <div className="text-xs text-muted-foreground">{step.description}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Next Step CTA */}
        {currentStep && !allComplete && !isPendingReview && (
          <Card className="p-6 text-center">
            <h2 className="text-2xl font-bold mb-2">Next Step: {currentStep.title}</h2>
            <p className="text-muted-foreground mb-6">{currentStep.description}</p>
            <Button
              size="lg"
              onClick={() => navigate(`/onboarding/portal/${token}/step${currentStepNumber}`)}
            >
              {completedSteps === 0 ? 'Get Started' : 'Continue'}
            </Button>
          </Card>
        )}

        {/* All Done - Pending Review */}
        {(allComplete || isPendingReview) && !isRosterReady && (
          <Card className="p-6 text-center bg-green-50 border-green-200">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">All Done!</h2>
            <p className="text-muted-foreground mb-4">
              You've completed all onboarding steps. Your information is now being reviewed by management.
            </p>
            <p className="text-sm text-muted-foreground">
              We'll notify you once your onboarding is approved and you're roster-ready.
            </p>
          </Card>
        )}

        {/* Approved */}
        {isRosterReady && (
          <Card className="p-6 text-center bg-green-50 border-green-200">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
            <p className="text-muted-foreground mb-4">
              Your onboarding has been approved. You're now roster-ready and will be scheduled for shifts soon.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
