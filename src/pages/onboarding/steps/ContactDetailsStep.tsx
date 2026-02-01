import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface ContactDetailsStepProps {
  staffId: string
  initialData?: {
    phone?: string
    email?: string
    emergency_contact_name?: string
    emergency_contact_phone?: string
    emergency_contact_relationship?: string
  }
  onComplete: (data: any) => void
  onBack?: () => void
}

export default function ContactDetailsStep({ staffId, initialData, onComplete, onBack }: ContactDetailsStepProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    emergency_contact_name: initialData?.emergency_contact_name || '',
    emergency_contact_phone: initialData?.emergency_contact_phone || '',
    emergency_contact_relationship: initialData?.emergency_contact_relationship || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onComplete(formData)
    toast({
      title: 'Contact details saved',
      description: 'Your contact information has been updated.'
    })
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
              required
              placeholder="04XX XXX XXX"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              required
              placeholder="you@example.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="font-semibold text-lg">Emergency Contact</h3>
          
          <div>
            <Label htmlFor="emergency_name">Contact Name *</Label>
            <Input
              id="emergency_name"
              required
              placeholder="Full name"
              value={formData.emergency_contact_name}
              onChange={e => setFormData({ ...formData, emergency_contact_name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="emergency_phone">Contact Phone *</Label>
            <Input
              id="emergency_phone"
              type="tel"
              required
              placeholder="04XX XXX XXX"
              value={formData.emergency_contact_phone}
              onChange={e => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="emergency_relationship">Relationship *</Label>
            <Input
              id="emergency_relationship"
              required
              placeholder="e.g., Parent, Spouse, Sibling"
              value={formData.emergency_contact_relationship}
              onChange={e => setFormData({ ...formData, emergency_contact_relationship: e.target.value })}
            />
          </div>
        </div>

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
