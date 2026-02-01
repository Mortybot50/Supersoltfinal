import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import * as Types from '@/types'

const ingredientFormSchema = z.object({
  name: z.string().min(1, "Required"),
  category: z.enum(['produce', 'meat', 'seafood', 'dairy', 'dry-goods', 'beverages', 'other']),
  unit: z.enum(['kg', 'g', 'L', 'mL', 'ea']),
  current_stock: z.number().nonnegative("Cannot be negative"),
  par_level: z.number().nonnegative("Cannot be negative"),
  cost_per_unit: z.number().nonnegative("Cannot be negative"),
  supplier_id: z.string().optional(),
})

type IngredientFormValues = z.infer<typeof ingredientFormSchema>

interface IngredientFormProps {
  onSubmit: (data: Partial<Types.Ingredient>) => void
  onCancel: () => void
  initialData?: Partial<Types.Ingredient>
}

export function IngredientForm({ onSubmit, onCancel, initialData }: IngredientFormProps) {
  const form = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      category: initialData?.category || 'produce',
      unit: initialData?.unit || 'kg',
      current_stock: initialData?.current_stock || 0,
      par_level: initialData?.par_level || 0,
      cost_per_unit: initialData?.cost_per_unit ? initialData.cost_per_unit / 100 : 0,
      supplier_id: initialData?.supplier_id || '',
    }
  })
  
  const handleSubmit = (data: IngredientFormValues) => {
    // Convert cost_per_unit to cents
    const ingredientData = {
      ...data,
      cost_per_unit: Math.round(data.cost_per_unit * 100),
    }
    onSubmit(ingredientData as any)
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ingredient Name *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Tomatoes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="produce">Produce</SelectItem>
                    <SelectItem value="meat">Meat</SelectItem>
                    <SelectItem value="seafood">Seafood</SelectItem>
                    <SelectItem value="dairy">Dairy</SelectItem>
                    <SelectItem value="dry-goods">Dry Goods</SelectItem>
                    <SelectItem value="beverages">Beverages</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="kg">Kilograms (kg)</SelectItem>
                    <SelectItem value="g">Grams (g)</SelectItem>
                    <SelectItem value="L">Liters (L)</SelectItem>
                    <SelectItem value="mL">Milliliters (mL)</SelectItem>
                    <SelectItem value="ea">Each (ea)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="current_stock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current Stock *</FormLabel>
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
            name="par_level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Par Level *</FormLabel>
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
        
        <FormField
          control={form.control}
          name="cost_per_unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cost Per Unit ($) *</FormLabel>
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
          name="supplier_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Supplier ID</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Optional" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
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
