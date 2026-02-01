-- Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  payment_terms TEXT DEFAULT 'net-30',
  account_number TEXT,
  delivery_days INTEGER[] NOT NULL DEFAULT ARRAY[1,3,5],
  cutoff_time TEXT NOT NULL DEFAULT '14:00',
  delivery_lead_days INTEGER NOT NULL DEFAULT 1,
  minimum_order INTEGER,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for suppliers (allow all operations for now)
CREATE POLICY "Allow all operations on suppliers" ON public.suppliers
FOR ALL USING (true) WITH CHECK (true);

-- Create ingredients table
CREATE TABLE IF NOT EXISTS public.ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  pack_size INTEGER DEFAULT 1,
  cost_per_unit INTEGER NOT NULL,
  gst_applicable BOOLEAN NOT NULL DEFAULT true,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  par_level NUMERIC NOT NULL DEFAULT 0,
  reorder_point NUMERIC NOT NULL DEFAULT 0,
  product_code TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_cost_update TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ingredients
CREATE POLICY "Allow all operations on ingredients" ON public.ingredients
FOR ALL USING (true) WITH CHECK (true);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  venue_id TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expected_delivery_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for purchase orders
CREATE POLICY "Allow all operations on purchase_orders" ON public.purchase_orders
FOR ALL USING (true) WITH CHECK (true);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE SET NULL,
  ingredient_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  unit_cost INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for purchase order items
CREATE POLICY "Allow all operations on purchase_order_items" ON public.purchase_order_items
FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_suppliers_organization ON public.suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(active);
CREATE INDEX IF NOT EXISTS idx_ingredients_supplier ON public.ingredients(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_venue ON public.ingredients(venue_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_active ON public.ingredients(active);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_venue ON public.purchase_orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON public.purchase_order_items(purchase_order_id);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();