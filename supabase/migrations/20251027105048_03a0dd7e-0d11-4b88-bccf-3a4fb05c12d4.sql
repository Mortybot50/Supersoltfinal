-- Create stock_counts table
CREATE TABLE IF NOT EXISTS public.stock_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  count_number TEXT NOT NULL,
  count_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  counted_by_user_id TEXT NOT NULL,
  counted_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'completed', 'reviewed')),
  total_variance_value INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create stock_count_items table
CREATE TABLE IF NOT EXISTS public.stock_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id UUID NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  expected_quantity NUMERIC NOT NULL,
  actual_quantity NUMERIC NOT NULL,
  variance NUMERIC NOT NULL,
  variance_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create waste_logs table
CREATE TABLE IF NOT EXISTS public.waste_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  waste_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  waste_time TEXT NOT NULL,
  ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  value INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spoilage', 'spillage', 'prep-waste', 'over-production', 'damaged', 'other')),
  notes TEXT,
  recorded_by_user_id TEXT NOT NULL,
  recorded_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu_items table
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  menu_group TEXT NOT NULL CHECK (menu_group IN ('food', 'beverages', 'other')),
  selling_price INTEGER NOT NULL,
  cost_price INTEGER NOT NULL DEFAULT 0,
  margin_percent NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  launch_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now - update based on your auth setup)
CREATE POLICY "Allow all operations on stock_counts" ON public.stock_counts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on stock_count_items" ON public.stock_count_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on waste_logs" ON public.waste_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on menu_items" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stock_counts_venue ON public.stock_counts(venue_id);
CREATE INDEX IF NOT EXISTS idx_stock_counts_date ON public.stock_counts(count_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_count_items_count ON public.stock_count_items(stock_count_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_venue ON public.waste_logs(venue_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_date ON public.waste_logs(waste_date DESC);
CREATE INDEX IF NOT EXISTS idx_waste_logs_ingredient ON public.waste_logs(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_venue ON public.menu_items(venue_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_stock_counts_updated_at ON public.stock_counts;
CREATE TRIGGER update_stock_counts_updated_at
  BEFORE UPDATE ON public.stock_counts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER update_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();