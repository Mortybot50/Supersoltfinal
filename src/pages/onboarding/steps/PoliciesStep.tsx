import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { FileText, AlertCircle } from 'lucide-react'

interface PoliciesStepProps {
  staffId: string
  onComplete: () => void
  onBack?: () => void
}

const WORKPLACE_POLICIES = [
  {
    id: 'code-of-conduct',
    title: 'Code of Conduct',
    mandatory: true,
    content: `Our Code of Conduct outlines expected behaviors and professional standards...

1. Respect and Professionalism
2. Health and Safety
3. Confidentiality
4. Conflict of Interest
5. Discrimination and Harassment Prevention`
  },
  {
    id: 'whs-policy',
    title: 'Work Health & Safety Policy',
    mandatory: true,
    content: `We are committed to providing a safe working environment...

1. Risk Assessment Procedures
2. Incident Reporting
3. Emergency Procedures
4. Personal Protective Equipment
5. Safe Work Practices`
  },
  {
    id: 'privacy-policy',
    title: 'Privacy Policy',
    mandatory: true,
    content: `How we collect, use and protect your personal information...

1. Information Collection
2. Data Storage and Security
3. Your Rights
4. Third Party Disclosure
5. Policy Updates`
  }
]

export default function PoliciesStep({ staffId, onComplete, onBack }: PoliciesStepProps) {
  const { toast } = useToast()
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({})
  const [selectedPolicy, setSelectedPolicy] = useState<string | null>(null)

  const allMandatoryAcknowledged = WORKPLACE_POLICIES
    .filter(p => p.mandatory)
    .every(p => acknowledged[p.id])

  const handleContinue = () => {
    if (!allMandatoryAcknowledged) {
      toast({
        title: 'Acknowledgment Required',
        description: 'Please read and acknowledge all mandatory policies.',
        variant: 'destructive'
      })
      return
    }

    // In real app, save acknowledgments to store
    toast({
      title: 'Policies acknowledged',
      description: 'You have acknowledged all workplace policies.'
    })
    
    onComplete()
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Workplace Policies</h2>
      <p className="text-muted-foreground mb-6">
        Please review and acknowledge these important workplace policies.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Policy List */}
        <div className="space-y-3">
          {WORKPLACE_POLICIES.map(policy => (
            <Card
              key={policy.id}
              className={`p-4 cursor-pointer transition-colors ${
                selectedPolicy === policy.id ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => setSelectedPolicy(policy.id)}
            >
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 mt-0.5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{policy.title}</div>
                  {policy.mandatory && (
                    <div className="text-xs text-destructive">Required</div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2 mt-3">
                <Checkbox
                  id={policy.id}
                  checked={acknowledged[policy.id] || false}
                  onCheckedChange={(checked) => {
                    setAcknowledged({ ...acknowledged, [policy.id]: checked as boolean })
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <Label 
                  htmlFor={policy.id} 
                  className="text-sm font-normal cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  I have read and understood this policy
                </Label>
              </div>
            </Card>
          ))}
        </div>

        {/* Policy Content */}
        <div>
          {selectedPolicy ? (
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-3">
                {WORKPLACE_POLICIES.find(p => p.id === selectedPolicy)?.title}
              </h3>
              <ScrollArea className="h-[400px] pr-4">
                <div className="whitespace-pre-wrap text-sm">
                  {WORKPLACE_POLICIES.find(p => p.id === selectedPolicy)?.content}
                </div>
              </ScrollArea>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select a policy to read</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {!allMandatoryAcknowledged && (
        <Alert className="mt-6">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            You must read and acknowledge all mandatory policies before continuing.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 pt-6 border-t mt-6">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <Button onClick={handleContinue} disabled={!allMandatoryAcknowledged}>
          Complete Onboarding
        </Button>
      </div>
    </Card>
  )
}
