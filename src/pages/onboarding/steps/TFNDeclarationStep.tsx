import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { tfnDeclarationSchema } from '@/lib/schemas/onboarding'
import { Info } from 'lucide-react'

interface TFNDeclarationData {
  tfn_number?: string
  tfn_declaration_status: string
  tfn_exemption_reason?: string
  tfn_claimed_tax_free_threshold: boolean
  tfn_has_help_debt: boolean
  tfn_has_ssl_debt: boolean
  tfn_has_tsl_debt: boolean
}

interface TFNDeclarationStepProps {
  staffId: string
  initialData?: Partial<TFNDeclarationData>
  onComplete: (data: TFNDeclarationData) => void
  onBack?: () => void
}

export default function TFNDeclarationStep({ staffId, initialData, onComplete, onBack }: TFNDeclarationStepProps) {
const [submitting, setSubmitting] = useState(false)
  const [declarationStatus, setDeclarationStatus] = useState(initialData?.tfn_declaration_status || 'provided')
  const [formData, setFormData] = useState({
    tfn_number: initialData?.tfn_number || '',
    tfn_exemption_reason: initialData?.tfn_exemption_reason || '',
    tfn_claimed_tax_free_threshold: initialData?.tfn_claimed_tax_free_threshold || false,
    tfn_has_help_debt: initialData?.tfn_has_help_debt || false,
    tfn_has_ssl_debt: initialData?.tfn_has_ssl_debt || false,
    tfn_has_tsl_debt: initialData?.tfn_has_tsl_debt || false
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate with Zod schema
    const payload = { ...formData, tfn_declaration_status: declarationStatus }
    const result = tfnDeclarationSchema.safeParse(payload)
    
    if (!result.success) {
      const newErrors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        const field = err.path[0]?.toString()
        if (field) newErrors[field] = err.message
      })
      setErrors(newErrors)
      return
    }

    onComplete({
      ...formData,
      tfn_declaration_status: declarationStatus,
      tfn_declaration_signed_at: new Date()
    })
    
    toast.success('TFN declaration saved', { description: 'Your tax information has been recorded.' })
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Tax File Number Declaration</h2>
      <p className="text-muted-foreground mb-6">
        This form complies with Australian Tax Office requirements. Your TFN is confidential and securely stored.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            Providing your TFN is not compulsory. However, if you don't provide it, tax will be withheld at the highest rate.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <Label>TFN Status *</Label>
          <RadioGroup value={declarationStatus} onValueChange={setDeclarationStatus}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="provided" id="provided" />
              <Label htmlFor="provided" className="font-normal">I have a TFN and will provide it</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="not_provided" id="not_provided" />
              <Label htmlFor="not_provided" className="font-normal">I don't have a TFN</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="exemption" id="exemption" />
              <Label htmlFor="exemption" className="font-normal">I have an exemption</Label>
            </div>
          </RadioGroup>
        </div>

        {declarationStatus === 'provided' && (
          <div>
            <Label htmlFor="tfn">Tax File Number *</Label>
            <Input
              id="tfn"
              placeholder="123 456 789"
              maxLength={11}
              value={formData.tfn_number}
              onChange={e => {
                const value = e.target.value.replace(/[^0-9\s]/g, '')
                setFormData({ ...formData, tfn_number: value })
                setErrors(prev => ({ ...prev, tfn_number: '' }))
              }}
              className={errors.tfn_number ? 'border-destructive' : ''}
            />
            {errors.tfn_number ? (
              <p className="text-sm text-destructive mt-1">{errors.tfn_number}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                9 digits - will be encrypted and stored securely
              </p>
            )}
          </div>
        )}

        {declarationStatus === 'exemption' && (
          <div>
            <Label htmlFor="exemption_reason">Exemption Reason *</Label>
            <Textarea
              id="exemption_reason"
              placeholder="Explain why you have an exemption"
              value={formData.tfn_exemption_reason}
              onChange={e => { setFormData({ ...formData, tfn_exemption_reason: e.target.value }); setErrors(prev => ({ ...prev, tfn_exemption_reason: '' })) }}
              className={errors.tfn_exemption_reason ? 'border-destructive' : ''}
            />
            {errors.tfn_exemption_reason && <p className="text-sm text-destructive mt-1">{errors.tfn_exemption_reason}</p>}
          </div>
        )}

        {declarationStatus === 'provided' && (
          <>
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Tax Options</h3>
              
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="tax_free_threshold"
                  checked={formData.tfn_claimed_tax_free_threshold}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, tfn_claimed_tax_free_threshold: checked as boolean })
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="tax_free_threshold" className="font-normal">
                    I want to claim the tax-free threshold
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only claim if this is your primary job. Reduces tax withheld.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Study & Training Loans</h3>
              <p className="text-sm text-muted-foreground">
                Select all that apply to you:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="help_debt"
                    checked={formData.tfn_has_help_debt}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, tfn_has_help_debt: checked as boolean })
                    }
                  />
                  <Label htmlFor="help_debt" className="font-normal">
                    I have a HELP debt (Higher Education Loan Program)
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="ssl_debt"
                    checked={formData.tfn_has_ssl_debt}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, tfn_has_ssl_debt: checked as boolean })
                    }
                  />
                  <Label htmlFor="ssl_debt" className="font-normal">
                    I have an SSL debt (Student Start-up Loan)
                  </Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="tsl_debt"
                    checked={formData.tfn_has_tsl_debt}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, tfn_has_tsl_debt: checked as boolean })
                    }
                  />
                  <Label htmlFor="tsl_debt" className="font-normal">
                    I have a TSL debt (Trade Support Loan)
                  </Label>
                </div>
              </div>
            </div>
          </>
        )}

        <Alert>
          <AlertDescription>
            <strong>Declaration:</strong> I declare that the information I have provided is true and correct.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2 pt-4">
          {onBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save & Continue
            </Button>
        </div>
      </form>
    </Card>
  )
}
