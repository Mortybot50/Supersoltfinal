import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { isValidEmail, isValidAUPhone } from '@/lib/utils/validation'

interface ContactDetailsData {
  phone: string
  email: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
}

interface ContactDetailsStepProps {
  staffId: string
  initialData?: Partial<ContactDetailsData>
  onComplete: (data: ContactDetailsData) => void
  onBack?: () => void
}

export default function ContactDetailsStep({ staffId, initialData, onComplete, onBack }: ContactDetailsStepProps) {
const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    emergency_contact_name: initialData?.emergency_contact_name || '',
    emergency_contact_phone: initialData?.emergency_contact_phone || '',
    emergency_contact_relationship: initialData?.emergency_contact_relationship || ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else if (!isValidAUPhone(formData.phone)) {
      newErrors.phone = 'Enter a valid Australian mobile (04XX XXX XXX)'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = 'Enter a valid email address'
    }

    if (!formData.emergency_contact_name.trim()) {
      newErrors.emergency_contact_name = 'Emergency contact name is required'
    }

    if (!formData.emergency_contact_phone.trim()) {
      newErrors.emergency_contact_phone = 'Emergency contact phone is required'
    } else if (!isValidAUPhone(formData.emergency_contact_phone)) {
      newErrors.emergency_contact_phone = 'Enter a valid Australian mobile (04XX XXX XXX)'
    }

    if (!formData.emergency_contact_relationship.trim()) {
      newErrors.emergency_contact_relationship = 'Relationship is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    onComplete(formData)
    toast.success('Contact details saved', { description: 'Your contact information has been updated.' })
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Contact Details</h2>
      <p className="text-muted-foreground mb-6">
        Please provide your contact information and emergency contact details.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Your Contact Information</h3>

          <div>
            <Label htmlFor="phone">Mobile Phone *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="04XX XXX XXX"
              value={formData.phone}
              onChange={e => { setFormData({ ...formData, phone: e.target.value }); setErrors(prev => ({ ...prev, phone: '' })) }}
              className={errors.phone ? 'border-destructive' : ''}
            />
            {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={e => { setFormData({ ...formData, email: e.target.value }); setErrors(prev => ({ ...prev, email: '' })) }}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-semibold text-lg">Emergency Contact</h3>

          <div>
            <Label htmlFor="emergency_name">Contact Name *</Label>
            <Input
              id="emergency_name"
              placeholder="Full name"
              value={formData.emergency_contact_name}
              onChange={e => { setFormData({ ...formData, emergency_contact_name: e.target.value }); setErrors(prev => ({ ...prev, emergency_contact_name: '' })) }}
              className={errors.emergency_contact_name ? 'border-destructive' : ''}
            />
            {errors.emergency_contact_name && <p className="text-sm text-destructive mt-1">{errors.emergency_contact_name}</p>}
          </div>

          <div>
            <Label htmlFor="emergency_phone">Contact Phone *</Label>
            <Input
              id="emergency_phone"
              type="tel"
              placeholder="04XX XXX XXX"
              value={formData.emergency_contact_phone}
              onChange={e => { setFormData({ ...formData, emergency_contact_phone: e.target.value }); setErrors(prev => ({ ...prev, emergency_contact_phone: '' })) }}
              className={errors.emergency_contact_phone ? 'border-destructive' : ''}
            />
            {errors.emergency_contact_phone && <p className="text-sm text-destructive mt-1">{errors.emergency_contact_phone}</p>}
          </div>

          <div>
            <Label htmlFor="emergency_relationship">Relationship *</Label>
            <Input
              id="emergency_relationship"
              placeholder="e.g., Parent, Spouse, Sibling"
              value={formData.emergency_contact_relationship}
              onChange={e => { setFormData({ ...formData, emergency_contact_relationship: e.target.value }); setErrors(prev => ({ ...prev, emergency_contact_relationship: '' })) }}
              className={errors.emergency_contact_relationship ? 'border-destructive' : ''}
            />
            {errors.emergency_contact_relationship && <p className="text-sm text-destructive mt-1">{errors.emergency_contact_relationship}</p>}
          </div>
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
