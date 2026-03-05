import { useParams, useNavigate } from 'react-router-dom'
import { Building2, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ONBOARDING_STEPS } from '@/lib/constants/onboarding'
import { supabase } from '@/integrations/supabase/client'
import { useEffect, useState } from 'react'
import ContactDetailsStep from './steps/ContactDetailsStep'
import AddressStep from './steps/AddressStep'
import BankDetailsStep from './steps/BankDetailsStep'
import TFNDeclarationStep from './steps/TFNDeclarationStep'
import SuperChoiceStep from './steps/SuperChoiceStep'
import DocumentsStep from './steps/DocumentsStep'
import PoliciesStep from './steps/PoliciesStep'

interface StaffRecord {
  id: string
  [key: string]: unknown
}

export default function InviteStep() {
  const { token, stepNumber } = useParams()
  const navigate = useNavigate()
  const currentStep = parseInt(stepNumber || '1')
  const [loading, setLoading] = useState(true)
  const [staffRecord, setStaffRecord] = useState<StaffRecord | null>(null)
  const [inviteValid, setInviteValid] = useState(false)

  useEffect(() => {
    if (!token) return

    const load = async () => {
      const { data: invite } = await supabase
        .from('staff_invites')
        .select('*')
        .eq('token', token)
        .single()

      if (!invite) {
        setLoading(false)
        return
      }

      setInviteValid(true)

      // Try to load staff record from Supabase
      const { data: staff } = await supabase
        .from('staff')
        .select('*')
        .eq('id', (invite as Record<string, unknown>).staff_id as string)
        .single()

      if (staff) {
        setStaffRecord(staff as unknown as StaffRecord)
      } else {
        // No staff record in Supabase — create a minimal one for the portal
        setStaffRecord({
          id: (invite as Record<string, unknown>).staff_id as string,
          name: (invite as Record<string, unknown>).sent_to_email as string,
          email: (invite as Record<string, unknown>).sent_to_email as string,
        })
      }

      setLoading(false)
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!inviteValid || !staffRecord) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Invite</h1>
          <p className="text-muted-foreground">This link is invalid. Please contact your manager.</p>
        </Card>
      </div>
    )
  }

  const progressPct = ((currentStep - 1) / ONBOARDING_STEPS.length) * 100

  const handleStepComplete = (data: Record<string, unknown>) => {
    // Update local state
    setStaffRecord(prev => prev ? { ...prev, ...data } : prev)

    // Navigate to next step or back to portal
    if (currentStep < ONBOARDING_STEPS.length) {
      navigate(`/onboarding/portal/${token}/step${currentStep + 1}`)
    } else {
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
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Contact Details</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Email:</span> {staffRecord.email as string ?? '—'}</div>
            <div><span className="text-muted-foreground">Phone:</span> {staffRecord.phone as string ?? '—'}</div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Address</h3>
          <p className="text-sm">
            {staffRecord.address_line1 ? (
              <>{staffRecord.address_line1 as string}{staffRecord.address_line2 ? `, ${staffRecord.address_line2 as string}` : ''}, {staffRecord.suburb as string} {staffRecord.state as string} {staffRecord.postcode as string}</>
            ) : (
              <span className="text-muted-foreground">Not provided</span>
            )}
          </p>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-2">Bank Details</h3>
          <div className="text-sm">
            {staffRecord.bank_account_name ? (
              <span>{staffRecord.bank_account_name as string} — BSB: {staffRecord.bank_bsb as string}</span>
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

  const commonProps = {
    staffId: staffRecord.id,
    initialData: staffRecord as Record<string, unknown>,
    onComplete: handleStepComplete,
    onBack: handleBack,
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <ContactDetailsStep {...commonProps} />
      case 2: return <AddressStep {...commonProps} />
      case 3: return <BankDetailsStep {...commonProps} />
      case 4: return <TFNDeclarationStep {...commonProps} />
      case 5: return <SuperChoiceStep {...commonProps} />
      case 6: return <DocumentsStep {...commonProps} onComplete={() => handleStepComplete({})} />
      case 7: return <PoliciesStep {...commonProps} onComplete={() => handleStepComplete({})} />
      case 8: return renderReviewStep()
      default: return <div>Invalid step</div>
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">SuperSolt</h1>
          </div>
          <p className="text-muted-foreground">Staff Onboarding</p>
        </div>

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

        {renderStep()}
      </div>
    </div>
  )
}
