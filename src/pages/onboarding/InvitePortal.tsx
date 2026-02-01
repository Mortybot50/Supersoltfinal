import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ONBOARDING_STEPS } from '@/lib/constants/onboarding'
import { CheckCircle, Clock, Circle, Building2 } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function InvitePortal() {
  const { token } = useParams()
  const navigate = useNavigate()
  
  // Standalone state - no auth required
  const [inviteData, setInviteData] = useState<{
    valid: boolean
    expired: boolean
    staffName?: string
    completedSteps?: number
  } | null>(null)
  
  useEffect(() => {
    // In a real app, this would validate the token via a public API endpoint
    // For now, simulating token validation
    if (token) {
      // Simulate API call to validate token
      setInviteData({
        valid: true,
        expired: false,
        staffName: 'New Team Member',
        completedSteps: 0
      })
    } else {
      setInviteData({ valid: false, expired: false })
    }
  }, [token])
  
  if (!inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }
  
  if (!inviteData.valid) {
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
  
  if (inviteData.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Invite Expired</h1>
          <p className="text-muted-foreground mb-6">
            This onboarding invite has expired.
          </p>
          <p className="text-sm text-muted-foreground">
            Please contact your manager for a new invite link.
          </p>
        </Card>
      </div>
    )
  }
  
  const completedSteps = inviteData.completedSteps || 0
  const totalSteps = ONBOARDING_STEPS.length
  const progress = (completedSteps / totalSteps) * 100
  
  const currentStepNumber = completedSteps + 1
  const currentStep = ONBOARDING_STEPS.find(s => s.number === currentStepNumber)
  
  const getStepIcon = (stepNumber: number) => {
    if (stepNumber < currentStepNumber) return <CheckCircle className="w-6 h-6 text-green-600" />
    if (stepNumber === currentStepNumber) return <Clock className="w-6 h-6 text-yellow-600" />
    return <Circle className="w-6 h-6 text-gray-400" />
  }
  
  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with branding */}
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
            <p className="text-lg text-muted-foreground">Hi {inviteData.staffName}, let's get you onboarded</p>
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
                className={`p-3 border rounded-lg ${step.number === currentStepNumber ? 'border-primary bg-primary/5' : ''}`}
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
        
        {currentStep && (
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
        
        {completedSteps === totalSteps && (
          <Card className="p-6 text-center bg-green-50 border-green-200">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">All Done!</h2>
            <p className="text-muted-foreground mb-4">
              You've completed all onboarding steps. Your information is now being reviewed by management.
            </p>
            <p className="text-sm text-muted-foreground">
              We'll notify you once your onboarding is approved.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
