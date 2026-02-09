export interface ColumnMapping {
  field: string
  header: string
  required: boolean
  type: 'string' | 'number' | 'date' | 'boolean' | 'email' | 'phone' | 'enum'
  example: string
  options?: string[]
  transform?: (value: unknown) => unknown
}

export const staffImportMapping: ColumnMapping[] = [
  { field: 'name', header: 'Staff Name', required: true, type: 'string', example: 'John Smith' },
  { field: 'email', header: 'Email', required: true, type: 'email', example: 'john.smith@email.com' },
  { field: 'phone', header: 'Phone', required: false, type: 'phone', example: '0412345678' },
  { field: 'role', header: 'Role', required: true, type: 'enum', example: 'crew', 
    options: ['manager', 'supervisor', 'crew'] },
  { field: 'hourly_rate', header: 'Hourly Rate ($)', required: true, type: 'number', example: '28.50' },
  { field: 'start_date', header: 'Start Date', required: true, type: 'date', example: '2024-01-01' },
]

export const ingredientImportMapping: ColumnMapping[] = [
  { field: 'name', header: 'Ingredient Name', required: true, type: 'string', example: 'Tomatoes' },
  { field: 'category', header: 'Category', required: true, type: 'enum', example: 'produce',
    options: ['produce', 'meat', 'seafood', 'dairy', 'dry-goods', 'beverages', 'other'] },
  { field: 'unit', header: 'Unit', required: true, type: 'enum', example: 'kg',
    options: ['kg', 'g', 'L', 'mL', 'ea'] },
  { field: 'current_stock', header: 'Current Stock', required: true, type: 'number', example: '15.5' },
  { field: 'par_level', header: 'Par Level', required: true, type: 'number', example: '25' },
  { field: 'cost_per_unit', header: 'Cost Per Unit ($)', required: true, type: 'number', example: '3.50' },
  { field: 'supplier_id', header: 'Supplier ID', required: false, type: 'string', example: 'SUP-001' },
]

export const supplierImportMapping: ColumnMapping[] = [
  { field: 'name', header: 'Supplier Name', required: true, type: 'string', example: 'Fresh Produce Co' },
  { field: 'contact_person', header: 'Contact Person', required: false, type: 'string', example: 'Jane Doe' },
  { field: 'email', header: 'Email', required: false, type: 'email', example: 'orders@freshproduce.com.au' },
  { field: 'phone', header: 'Phone', required: false, type: 'phone', example: '0398765432' },
  { field: 'address', header: 'Address', required: false, type: 'string', example: '123 Market St' },
  { field: 'category', header: 'Category', required: true, type: 'enum', example: 'produce',
    options: ['produce', 'meat', 'dry-goods', 'beverages', 'equipment', 'other'] },
  { field: 'payment_terms', header: 'Payment Terms', required: true, type: 'enum', example: 'net-14',
    options: ['cod', 'net-7', 'net-14', 'net-30'] },
  { field: 'account_number', header: 'Account Number', required: false, type: 'string', example: 'ACC-12345' },
]

export const orderImportMapping: ColumnMapping[] = [
  { field: 'order_number', header: 'Order Number', required: true, type: 'string', example: 'ORD-20241026-001' },
  { field: 'order_datetime', header: 'Order Date & Time', required: true, type: 'date', example: '2024-10-26 14:30:00' },
  { field: 'channel', header: 'Channel', required: true, type: 'enum', example: 'dine-in',
    options: ['dine-in', 'takeaway', 'delivery', 'online'] },
  { field: 'gross_amount', header: 'Gross Amount ($)', required: true, type: 'number', example: '45.50',
    transform: (value) => Math.round(value * 100) }, // Convert to cents
  { field: 'tax_amount', header: 'Tax Amount ($)', required: true, type: 'number', example: '4.14',
    transform: (value) => Math.round(value * 100) },
  { field: 'discount_amount', header: 'Discount ($)', required: false, type: 'number', example: '0.00',
    transform: (value) => Math.round(value * 100) },
  { field: 'net_amount', header: 'Net Amount ($)', required: true, type: 'number', example: '41.36',
    transform: (value) => Math.round(value * 100) },
]

export const menuItemImportMapping: ColumnMapping[] = [
  { field: 'name', header: 'Menu Item Name', required: true, type: 'string', example: 'Flat White' },
  { field: 'category', header: 'Category', required: true, type: 'string', example: 'Coffee' },
  { field: 'menu_group', header: 'Menu Group', required: true, type: 'enum', example: 'beverages',
    options: ['food', 'beverages', 'retail'] },
  { field: 'selling_price', header: 'Selling Price ($)', required: true, type: 'number', example: '4.50' },
  { field: 'pos_code', header: 'POS Code', required: false, type: 'string', example: 'COF-FW' },
  { field: 'description', header: 'Description', required: false, type: 'string', example: 'Classic espresso with milk' },
]

// Map entity type to column mapping
export const importMappings: Record<string, ColumnMapping[]> = {
  staff: staffImportMapping,
  ingredients: ingredientImportMapping,
  suppliers: supplierImportMapping,
  orders: orderImportMapping,
  menuItems: menuItemImportMapping,
  sales: orderImportMapping, // Alias for orders
}
