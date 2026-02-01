import { z } from 'zod'

// Staff validation schema
export const staffImportSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  role: z.enum(['manager', 'supervisor', 'crew']),
  hourly_rate: z.number().positive("Hourly rate must be positive"),
  start_date: z.date(),
})

// Ingredient validation schema
export const ingredientImportSchema = z.object({
  name: z.string().min(1, "Ingredient name required"),
  category: z.enum(['produce', 'meat', 'seafood', 'dairy', 'dry-goods', 'beverages', 'other']),
  unit: z.enum(['kg', 'g', 'L', 'mL', 'ea']),
  current_stock: z.number().nonnegative("Stock cannot be negative"),
  par_level: z.number().nonnegative("Par level cannot be negative"),
  cost_per_unit: z.number().nonnegative("Cost cannot be negative"),
  supplier_id: z.string().optional(),
})

// Supplier validation schema
export const supplierImportSchema = z.object({
  name: z.string().min(1, "Supplier name required"),
  contact_person: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  category: z.enum(['produce', 'meat', 'dry-goods', 'beverages', 'equipment', 'other']),
  payment_terms: z.enum(['net-7', 'net-14', 'net-30', 'cod']),
  account_number: z.string().optional(),
})

// Order validation schema
export const orderImportSchema = z.object({
  order_number: z.string().min(1, "Order number required"),
  order_datetime: z.date(),
  channel: z.enum(['dine-in', 'takeaway', 'delivery', 'online']),
  gross_amount: z.number().nonnegative("Amount cannot be negative"),
  tax_amount: z.number().nonnegative("Tax cannot be negative"),
  discount_amount: z.number().nonnegative("Discount cannot be negative"),
  net_amount: z.number().nonnegative("Net amount cannot be negative"),
})

// Menu Item validation schema
export const menuItemImportSchema = z.object({
  name: z.string().min(1, "Item name required"),
  category: z.string().min(1, "Category required"),
  menu_group: z.enum(['food', 'beverages', 'retail']),
  selling_price: z.number().positive("Price must be positive"),
  pos_code: z.string().optional(),
  description: z.string().optional(),
})

// Recipe validation schema
export const recipeImportSchema = z.object({
  name: z.string().min(1, "Recipe name required"),
  category: z.string().min(1, "Category required"),
  yield_quantity: z.number().positive("Yield must be positive"),
  yield_unit: z.string().min(1, "Yield unit required"),
})
