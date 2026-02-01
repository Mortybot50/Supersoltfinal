-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  order_datetime TIMESTAMPTZ NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('dine-in', 'takeaway', 'delivery', 'online')),
  gross_amount INTEGER NOT NULL, -- cents
  tax_amount INTEGER NOT NULL, -- cents
  discount_amount INTEGER NOT NULL DEFAULT 0, -- cents
  net_amount INTEGER NOT NULL, -- cents
  service_charge INTEGER NOT NULL DEFAULT 0, -- cents
  tip_amount INTEGER NOT NULL DEFAULT 0, -- cents
  is_void BOOLEAN NOT NULL DEFAULT false,
  is_refund BOOLEAN NOT NULL DEFAULT false,
  refund_reason TEXT,
  staff_member TEXT,
  customer_name TEXT,
  payment_method TEXT CHECK (payment_method IN ('card', 'cash', 'digital_wallet')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for performance
CREATE INDEX idx_orders_venue_id ON public.orders(venue_id);
CREATE INDEX idx_orders_order_datetime ON public.orders(order_datetime);
CREATE INDEX idx_orders_order_number ON public.orders(order_number);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - allow all operations for now (can be restricted later)
CREATE POLICY "Allow all operations on orders"
  ON public.orders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();