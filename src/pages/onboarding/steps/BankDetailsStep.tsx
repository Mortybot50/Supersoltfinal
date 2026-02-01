import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { validateBSB, lookupBank, formatBSB } from '@/lib/utils/bsbLookup'
import { CheckCircle, AlertCircle } from 'lucide-react'

interface BankDetailsStepProps {
  staffId: string
  initialData?: {
    bank_account_name?: string
    bank_bsb?: string
    bank_account_number?: string
    bank_account_type?: string
    bank_institution_name?: string
  }
  onComplete: (data: any) => void
  onBack?: () => void
}

export default function BankDetailsStep({ staffId, initialData, onComplete, onBack }: BankDetailsStepProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    bank_account_name: initialData?.bank_account_name || '',
    bank_bsb: initialData?.bank_bsb || '',
    bank_account_number: initialData?.bank_account_number || '',
    bank_account_type: initialData?.bank_account_type || 'savings',
    bank_institution_name: initialData?.bank_institution_name || ''
  })

  const [bsbValid, setBsbValid] = useState<boolean | null>(null)
  const [bankName, setBankName] = useState<string>('')

  useEffect(() => {
    if (formData.bank_bsb.length >= 6) {
      const isValid = validateBSB(formData.bank_bsb)
      setBsbValid(isValid)
      
      if (isValid) {
        const bankInfo = lookupBank(formData.bank_bsb)
        if (bankInfo) {
          setBankName(bankInfo.bank)
          setFormData(prev => ({ ...prev, bank_institution_name: bankInfo.bank }))
        }
      }
    } else {
      setBsbValid(null)
      setBankName('')
    }
  }, [formData.bank_bsb])

  const handleBSBChange = (value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '')
    setFormData({ ...formData, bank_bsb: cleaned })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!bsbValid) {
      toast({
        title: 'Invalid BSB',
        description: 'Please enter a valid 6-digit BSB number.',
        variant: 'destructive'
      })
      return
    }

    onComplete({
      ...formData,
      bank_bsb: formatBSB(formData.bank_bsb)
    })
    
    toast({
      title: 'Bank details saved',
      description: 'Your payment information has been securely stored.'
    })
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Bank Details</h2>
      <p className="text-muted-foreground mb-6">
        Your salary will be paid into this account. All information is securely encrypted.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="account_name">Account Name *</Label>
          <Input
            id="account_name"
            required
            placeholder="Full name as shown on account"
            value={formData.bank_account_name}
            onChange={e => setFormData({ ...formData, bank_account_name: e.target.value })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Must match the name on your bank account
          </p>
        </div>

        <div>
          <Label htmlFor="bsb">BSB Number *</Label>
          <Input
            id="bsb"
            required
            placeholder="123-456"
            maxLength={7}
            value={formatBSB(formData.bank_bsb)}
            onChange={e => handleBSBChange(e.target.value)}
          />
          {bsbValid === true && (
            <div className="flex items-center gap-2 mt-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>Valid BSB - {bankName}</span>
            </div>
          )}
          {bsbValid === false && (
            <div className="flex items-center gap-2 mt-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span>Invalid BSB number</span>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="account_number">Account Number *</Label>
          <Input
            id="account_number"
            required
            placeholder="12345678"
            pattern="[0-9]{6,10}"
            maxLength={10}
            value={formData.bank_account_number}
            onChange={e => setFormData({ ...formData, bank_account_number: e.target.value.replace(/[^0-9]/g, '') })}
          />
        </div>

        <div>
          <Label htmlFor="account_type">Account Type *</Label>
          <Select value={formData.bank_account_type} onValueChange={value => setFormData({ ...formData, bank_account_type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="savings">Savings Account</SelectItem>
              <SelectItem value="checking">Checking Account</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Security Note:</strong> Your bank details are encrypted and stored securely. 
            They will only be used for salary payments.
          </AlertDescription>
        </Alert>

        <div className="flex gap-2 pt-4">
          {onBack && (
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="submit">Save & Continue</Button>
        </div>
      </form>
    </Card>
  )
}
