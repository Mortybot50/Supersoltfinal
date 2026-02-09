import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import * as Types from '@/types'

const orderFormSchema = z.object({
  order_number: z.string().min(1, "Required"),
  order_datetime: z.string(),
  channel: z.enum(['dine-in', 'takeaway', 'delivery', 'online']),
  gross_amount: z.number().nonnegative("Cannot be negative"),
  tax_amount: z.number().nonnegative("Cannot be negative"),
  discount_amount: z.number().nonnegative("Cannot be negative"),
  net_amount: z.number().nonnegative("Cannot be negative"),
})

type OrderFormValues = z.infer<typeof orderFormSchema>

interface OrderFormProps {
  onSubmit: (data: Partial<Types.Order>) => void
  onCancel: () => void
  initialData?: Partial<Types.Order>
}

export function OrderForm({ onSubmit, onCancel, initialData }: OrderFormProps) {
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      order_number: initialData?.order_number || '',
      order_datetime: initialData?.order_datetime 
        ? new Date(initialData.order_datetime).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      channel: initialData?.channel || 'dine-in',
      gross_amount: initialData?.gross_amount ? initialData.gross_amount / 100 : 0,
      tax_amount: initialData?.tax_amount ? initialData.tax_amount / 100 : 0,
      discount_amount: initialData?.discount_amount ? initialData.discount_amount / 100 : 0,
      net_amount: initialData?.net_amount ? initialData.net_amount / 100 : 0,
    }
  })
  
  const handleSubmit = (data: OrderFormValues) => {
    // Convert to cents and proper dates
    const orderData = {
      ...data,
      order_datetime: new Date(data.order_datetime),
      gross_amount: Math.round(data.gross_amount * 100),
      tax_amount: Math.round(data.tax_amount * 100),
      discount_amount: Math.round(data.discount_amount * 100),
      net_amount: Math.round(data.net_amount * 100),
    }
    onSubmit(orderData as Partial<Types.Order>)
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="order_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Order Number *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="ORD-001" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="channel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="dine-in">Dine In</SelectItem>
                    <SelectItem value="takeaway">Takeaway</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="order_datetime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order Date & Time *</FormLabel>
              <FormControl>
                <Input {...field} type="datetime-local" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="gross_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gross Amount ($) *</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    type="number" 
                    step="0.01"
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="tax_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax Amount ($) *</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    type="number" 
                    step="0.01"
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="discount_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discount ($)</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    type="number" 
                    step="0.01"
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="net_amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Net Amount ($) *</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    type="number" 
                    step="0.01"
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="flex gap-2 pt-4">
          <Button type="submit">Save</Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
