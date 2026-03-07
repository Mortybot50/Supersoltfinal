import { z } from "zod"

export const createMenuItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  priceCents: z.number().int().min(0, "Price must be non-negative"),
  sku: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  isComposite: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const updateMenuItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  priceCents: z.number().int().min(0).optional(),
  sku: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  isComposite: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const createIngredientSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  unit: z.string().min(1, "Unit is required").max(50),
  costPerUnitCents: z.number().int().min(0, "Cost must be non-negative"),
  currentStockLevel: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid stock level format"),
  isActive: z.boolean().default(true),
})

export const updateIngredientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  unit: z.string().min(1).max(50).optional(),
  costPerUnitCents: z.number().int().min(0).optional(),
  currentStockLevel: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  isActive: z.boolean().optional(),
})

// Supplier schemas
export const createSupplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  contactEmail: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
})

export const updateSupplierSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contactEmail: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
})

// Ingredient Supplier schemas
export const createIngredientSupplierSchema = z.object({
  ingredientId: z.string().uuid("Invalid ingredient ID"),
  supplierId: z.string().uuid("Invalid supplier ID"),
  packSize: z.number().min(0).optional(),
  packUnit: z.string().max(50).optional(),
  unitPriceCents: z.number().int().min(0, "Price must be non-negative"),
  leadTimeDays: z.number().int().min(0).default(0),
  sku: z.string().max(100).optional(),
  isPreferred: z.boolean().default(false),
})

export const updateIngredientSupplierSchema = z.object({
  packSize: z.number().min(0).optional(),
  packUnit: z.string().max(50).optional(),
  unitPriceCents: z.number().int().min(0).optional(),
  leadTimeDays: z.number().int().min(0).optional(),
  sku: z.string().max(100).optional(),
  isPreferred: z.boolean().optional(),
})

// Recipe (header) schemas
export const createRecipeSchema = z.object({
  menuItemId: z.string().uuid("Invalid menu item ID"),
  yieldQty: z.number().min(0.001).default(1),
  yieldUnit: z.string().max(50).optional(),
  wastagePct: z.number().min(0).max(100).default(0),
})

export const updateRecipeSchema = z.object({
  yieldQty: z.number().min(0.001).optional(),
  yieldUnit: z.string().max(50).optional(),
  wastagePct: z.number().min(0).max(100).optional(),
})

// Recipe Line schemas - must have exactly one of ingredientId or subMenuItemId
export const createRecipeLineSchema = z.object({
  recipeId: z.string().uuid("Invalid recipe ID"),
  ingredientId: z.string().uuid("Invalid ingredient ID").optional(),
  subMenuItemId: z.string().uuid("Invalid menu item ID").optional(),
  qty: z.number().min(0.001, "Quantity must be positive"),
  unit: z.string().min(1, "Unit is required").max(50),
  notes: z.string().optional(),
}).refine(
  (data) => (data.ingredientId && !data.subMenuItemId) || (!data.ingredientId && data.subMenuItemId),
  { message: "Exactly one of ingredientId or subMenuItemId must be provided" }
)

export const updateRecipeLineSchema = z.object({
  qty: z.number().min(0.001).optional(),
  unit: z.string().min(1).max(50).optional(),
  notes: z.string().optional(),
})

export const createDailySaleSchema = z.object({
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  menuItemId: z.string().uuid("Invalid menu item ID"),
  quantitySold: z.number().int().min(1, "Quantity must be at least 1"),
})

export const updateDailySaleSchema = z.object({
  quantitySold: z.number().int().min(1, "Quantity must be at least 1"),
})

// CSV Import schema
export const importCSVSaleSchema = z.object({
  csvData: z.string().min(1, "CSV data is required"),
  dateColumn: z.string().default("Date"),
  menuItemColumn: z.string().default("Menu Item"),
  quantityColumn: z.string().default("Quantity"),
})
