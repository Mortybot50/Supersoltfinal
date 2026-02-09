import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { AUSTRALIAN_SUPER_FUNDS } from '@/lib/data/superFunds'
import { Check, ChevronsUpDown, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SuperChoiceData {
  super_choice_status: string
  super_fund_name: string
  super_fund_abn: string
  super_fund_usi: string
  super_member_number: string
}

interface SuperChoiceStepProps {
  staffId: string
  initialData?: Partial<SuperChoiceData>
  onComplete: (data: SuperChoiceData) => void
  onBack?: () => void
}

export default function SuperChoiceStep({ staffId, initialData, onComplete, onBack }: SuperChoiceStepProps) {
  const { toast } = useToast()
  const [choiceStatus, setChoiceStatus] = useState(initialData?.super_choice_status || 'provided')
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({
    super_fund_name: initialData?.super_fund_name || '',
    super_fund_abn: initialData?.super_fund_abn || '',
    super_fund_usi: initialData?.super_fund_usi || '',
    super_member_number: initialData?.super_member_number || ''
  })

  const filteredFunds = useMemo(() => {
    return AUSTRALIAN_SUPER_FUNDS.filter(fund =>
      fund.fund_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [searchQuery])

  const handleFundSelect = (fund: typeof AUSTRALIAN_SUPER_FUNDS[0]) => {
    setFormData({
      ...formData,
      super_fund_name: fund.fund_name,
      super_fund_abn: fund.abn,
      super_fund_usi: fund.usi
    })
    setOpen(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (choiceStatus === 'provided') {
      if (!formData.super_fund_name || !formData.super_member_number) {
        toast({
          title: 'Missing Information',
          description: 'Please select a super fund and provide your member number.',
          variant: 'destructive'
        })
        return
      }
    }

    onComplete({
      ...formData,
      super_choice_status: choiceStatus,
      super_choice_signed_at: new Date()
    })
    
    toast({
      title: 'Super choice saved',
      description: 'Your superannuation selection has been recorded.'
    })
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Superannuation Choice</h2>
      <p className="text-muted-foreground mb-6">
        Choose where your superannuation contributions will be paid (minimum 11.5% of your salary).
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            If you don't choose a fund, we'll check for a stapled fund. If none exists, 
            contributions will go to our default fund (Hostplus).
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <Label>Super Fund Choice *</Label>
          <RadioGroup value={choiceStatus} onValueChange={setChoiceStatus}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="provided" id="choose_fund" />
              <Label htmlFor="choose_fund" className="font-normal">I want to choose my super fund</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="stapled" id="stapled" />
              <Label htmlFor="stapled" className="font-normal">Use my stapled fund (ATO will provide)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="not_provided" id="default_fund" />
              <Label htmlFor="default_fund" className="font-normal">Use company default fund (Hostplus)</Label>
            </div>
          </RadioGroup>
        </div>

        {choiceStatus === 'provided' && (
          <>
            <div>
              <Label>Select Super Fund *</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {formData.super_fund_name || "Select fund..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Search super funds..." 
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandEmpty>No fund found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {filteredFunds.map((fund) => (
                        <CommandItem
                          key={fund.abn}
                          onSelect={() => handleFundSelect(fund)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.super_fund_abn === fund.abn ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <div>{fund.fund_name}</div>
                            <div className="text-xs text-muted-foreground">
                              ABN: {fund.abn} | USI: {fund.usi}
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {formData.super_fund_name && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ABN</Label>
                    <Input value={formData.super_fund_abn} disabled />
                  </div>
                  <div>
                    <Label>USI</Label>
                    <Input value={formData.super_fund_usi} disabled />
                  </div>
                </div>

                <div>
                  <Label htmlFor="member_number">Member Number *</Label>
                  <Input
                    id="member_number"
                    required
                    placeholder="Your member/account number"
                    value={formData.super_member_number}
                    onChange={e => setFormData({ ...formData, super_member_number: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Find this on your super fund statements or member portal
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {choiceStatus === 'stapled' && (
          <Alert>
            <AlertDescription>
              We'll request your stapled super fund details from the ATO. 
              This is a fund linked to you that moves with you between jobs.
            </AlertDescription>
          </Alert>
        )}

        {choiceStatus === 'not_provided' && (
          <Alert>
            <AlertDescription>
              <strong>Default Fund: Hostplus</strong><br />
              ABN: 68901251351 | USI: HOS0001AU<br />
              A new account will be created for you automatically.
            </AlertDescription>
          </Alert>
        )}

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
