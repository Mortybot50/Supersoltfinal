import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
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
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    address_line1: initialData?.address_line1 || '',
    address_line2: initialData?.address_line2 || '',
    suburb: initialData?.suburb || '',
    state: initialData?.state || '',
    postcode: initialData?.postcode || ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onComplete(formData)
    toast({
      title: 'Address saved',
      description: 'Your residential address has been updated.'
    })
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
            required
            placeholder="123 Main Street"
            value={formData.address_line1}
            onChange={e => setFormData({ ...formData, address_line1: e.target.value })}
          />
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
              required
              placeholder="Melbourne"
              value={formData.suburb}
              onChange={e => setFormData({ ...formData, suburb: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="postcode">Postcode *</Label>
            <Input
              id="postcode"
              required
              placeholder="3000"
              pattern="[0-9]{4}"
              value={formData.postcode}
              onChange={e => setFormData({ ...formData, postcode: e.target.value })}
            />
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
          <Button type="submit">Save & Continue</Button>
        </div>
      </form>
    </Card>
  )
}
