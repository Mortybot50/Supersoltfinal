import { z } from "zod";

export const IngredientRow = z.object({
  external_id: z.string().min(1, "External ID is required"),
  name: z.string().min(1, "Name is required"),
  uom: z.enum(["g", "kg", "ml", "l", "each"], {
    errorMap: () => ({ message: "Unit must be one of: g, kg, ml, l, each" })
  }),
  pack_size: z.string().optional(),
  pack_cost: z.string().optional(),
  supplier_external_id: z.string().optional(),
});

export const SupplierRow = z.object({
  external_id: z.string().min(1, "External ID is required"),
  name: z.string().min(1, "Name is required"),
  contact_email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const MenuItemRow = z.object({
  external_id: z.string().min(1, "External ID is required"),
  name: z.string().min(1, "Name is required"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid number"),
  category: z.string().optional(),
  recipe_json: z.string().optional(),
});

export const StaffRow = z.object({
  external_id: z.string().min(1, "External ID is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  role: z.string().min(1, "Role is required"),
  hourly_rate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Hourly rate must be a valid number"),
});

export const SalesDailyRow = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  menu_item_external_id: z.string().min(1, "Menu item external ID is required"),
  qty: z.string().regex(/^\d+(\.\d{1,2})?$/, "Quantity must be a valid number"),
  revenue: z.string().regex(/^\d+(\.\d{1,2})?$/, "Revenue must be a valid number").optional(),
});

export const StockRow = z.object({
  ingredient_external_id: z.string().min(1, "Ingredient external ID is required"),
  on_hand_qty: z.string().regex(/^\d+(\.\d{1,2})?$/, "On hand quantity must be a valid number"),
  uom: z.enum(["g", "kg", "ml", "l", "each"], {
    errorMap: () => ({ message: "Unit must be one of: g, kg, ml, l, each" })
  }),
});

export type IngredientRowType = z.infer<typeof IngredientRow>;
export type SupplierRowType = z.infer<typeof SupplierRow>;
export type MenuItemRowType = z.infer<typeof MenuItemRow>;
export type StaffRowType = z.infer<typeof StaffRow>;
export type SalesDailyRowType = z.infer<typeof SalesDailyRow>;
export type StockRowType = z.infer<typeof StockRow>;
