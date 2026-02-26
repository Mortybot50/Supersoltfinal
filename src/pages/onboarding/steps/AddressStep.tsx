import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { isValidPostcode } from '@/lib/utils/validation'
import { AUSTRALIAN_STATES } from '@/lib/data/awards'

interface AddressData {
  address_line1: string
  address_line2: string
  suburb: string
  state: string
  postcode: string
}

interface AddressStepProps {
  staffId: string
  initialData?: Partial<AddressData>
  onComplete: (data: AddressData) => void
  onBack?: () => void
}

export default function AddressStep({ staffId, initialData, onComplete, onBack }: AddressStepProps) {
const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    address_line1: initialData?.address_line1 || '',
    address_line2: initialData?.address_line2 || '',
    suburb: initialData?.suburb || '',
    state: initialData?.state || '',
    postcode: initialData?.postcode || ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.address_line1.trim()) newErrors.address_line1 = 'Street address is required'
    if (!formData.suburb.trim()) newErrors.suburb = 'Suburb is required'
    if (!formData.state) newErrors.state = 'State is required'
    if (!formData.postcode.trim()) {
      newErrors.postcode = 'Postcode is required'
    } else if (!isValidPostcode(formData.postcode)) {
      newErrors.postcode = 'Enter a valid 4-digit postcode'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onComplete(formData)
    toast.success('Address saved', { description: 'Your residential address has been updated.' })
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Residential Address</h2>
      <p className="text-muted-foreground mb-6">
        Please provide your current residential address.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="address_line1">Street Address *</Label>
          <Input
            id="address_line1"
            placeholder="123 Main Street"
            value={formData.address_line1}
            onChange={e => { setFormData({ ...formData, address_line1: e.target.value }); setErrors(prev => ({ ...prev, address_line1: '' })) }}
            className={errors.address_line1 ? 'border-destructive' : ''}
          />
          {errors.address_line1 && <p className="text-sm text-destructive mt-1">{errors.address_line1}</p>}
        </div>

        <div>
          <Label htmlFor="address_line2">Unit/Apartment (Optional)</Label>
          <Input
            id="address_line2"
            placeholder="Unit 5"
            value={formData.address_line2}
            onChange={e => setFormData({ ...formData, address_line2: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="suburb">Suburb *</Label>
            <Input
              id="suburb"
              placeholder="Melbourne"
              value={formData.suburb}
              onChange={e => { setFormData({ ...formData, suburb: e.target.value }); setErrors(prev => ({ ...prev, suburb: '' })) }}
              className={errors.suburb ? 'border-destructive' : ''}
            />
            {errors.suburb && <p className="text-sm text-destructive mt-1">{errors.suburb}</p>}
          </div>

          <div>
            <Label htmlFor="postcode">Postcode *</Label>
            <Input
              id="postcode"
              placeholder="3000"
              maxLength={4}
              value={formData.postcode}
              onChange={e => { setFormData({ ...formData, postcode: e.target.value.replace(/\D/g, '') }); setErrors(prev => ({ ...prev, postcode: '' })) }}
              className={errors.postcode ? 'border-destructive' : ''}
            />
            {errors.postcode && <p className="text-sm text-destructive mt-1">{errors.postcode}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="state">State *</Label>
          <Select value={formData.state} onValueChange={value => setFormData({ ...formData, state: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {AUSTRALIAN_STATES.map(state => (
                <SelectItem key={state.code} value={state.code}>{state.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
