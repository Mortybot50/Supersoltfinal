import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ONBOARDING_STEPS } from '@/lib/constants/onboarding'
import { CheckCircle, Clock, Circle, Building2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface InviteData {
  id: string
  org_id: string
  staff_id: string
  token: string
  sent_to_email: string
  expires_at: string
  completed_at: string | null
}

interface StaffData {
  id: string
  onboarding_status: string
  onboarding_progress: number | null
  org_member_id: string
}

interface StepData {
  id: string
  staff_id: string
  step_number: number
  step_name: string
  status: string
  completed_at: string | null
}

export default function InvitePortal() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<InviteData | null>(null)
  const [staffName, setStaffName] = useState('')
  const [staffStatus, setStaffStatus] = useState('')
  const [steps, setSteps] = useState<StepData[]>([])

  useEffect(() => {
    if (!token) return

    const loadInvite = async () => {
      try {
        // Look up invite by token
        const { data: inviteData, error: inviteError } = await supabase
          .from('staff_invites')
          .select('*')
          .eq('token', token)
          .single()

        if (inviteError || !inviteData) {
          setError('invalid')
          setLoading(false)
          return
        }

        const inv = inviteData as unknown as InviteData

        // Check expiry
        if (new Date() > new Date(inv.expires_at)) {
          setError('expired')
          setLoading(false)
          return
        }

        setInvite(inv)

        // Try to look up staff record
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, onboarding_status, org_member_id')
          .eq('id', inv.staff_id)
          .single()

        if (staffData) {
          const s = staffData as unknown as StaffData
          setStaffStatus(s.onboarding_status)

          // Get member name via org_members -> profiles
          const { data: memberData } = await supabase
            .from('org_members')
            .select('user_id')
            .eq('id', s.org_member_id)
            .single()

          if (memberData?.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', memberData.user_id)
              .single()

            if (profileData) {
              setStaffName(`${profileData.first_name ?? ''} ${profileData.last_name ?? ''}`.trim())
            }
          }
        } else {
          // Staff record may not exist in Supabase yet (Zustand-only legacy)
          setStaffName(inv.sent_to_email)
          setStaffStatus('invited')
        }

        // Mark as accessed
        if (!inv.completed_at) {
          await supabase
            .from('staff_invites')
            .update({ accessed_at: new Date().toISOString() })
            .eq('id', inv.id)
        }
      } catch {
        setError('invalid')
      }
      setLoading(false)
    }

    loadInvite()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error === 'invalid' || !invite) {
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

  if (error === 'expired') {
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
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  const currentStepNumber = completedSteps + 1
  const currentStep = ONBOARDING_STEPS.find(s => s.number === currentStepNumber)

  const allComplete = completedSteps >= totalSteps
  const isPendingReview = staffStatus === 'pending_review'
  const isRosterReady = staffStatus === 'roster_ready'

  const getStepIcon = (stepNumber: number) => {
    const step = steps.find(s => s.step_number === stepNumber)
    if (step?.status === 'completed') return <CheckCircle className="w-6 h-6 text-green-600" />
    if (stepNumber === currentStepNumber && !allComplete) return <Clock className="w-6 h-6 text-yellow-600" />
    return <Circle className="w-6 h-6 text-gray-400" />
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
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
            <p className="text-lg text-muted-foreground">
              Hi {staffName || 'there'}, let&apos;s get you onboarded
            </p>
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

        {(allComplete || isPendingReview) && !isRosterReady && (
          <Card className="p-6 text-center bg-green-50 border-green-200">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">All Done!</h2>
            <p className="text-muted-foreground mb-4">
              You&apos;ve completed all onboarding steps. Your information is now being reviewed by management.
            </p>
          </Card>
        )}

        {isRosterReady && (
          <Card className="p-6 text-center bg-green-50 border-green-200">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You&apos;re All Set!</h2>
            <p className="text-muted-foreground mb-4">
              Your onboarding has been approved. You&apos;re now roster-ready.
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
