-- Create inv_locations table for inventory storage areas
CREATE TABLE public.inv_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT,
  venue_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  type TEXT NOT NULL,
  temperature_target_c NUMERIC,
  counting_method TEXT DEFAULT 'Mixed',
  default_uom TEXT,
  capacity_hint TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT inv_locations_venue_name_unique UNIQUE (venue_id, name),
  CONSTRAINT inv_locations_venue_code_unique UNIQUE (venue_id, code)
);

-- Create inv_bins table for storage bins within locations
CREATE TABLE public.inv_bins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES public.inv_locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  barcode TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inv_location_assignments table for ingredient to location/bin mapping
CREATE TABLE public.inv_location_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id TEXT,
  venue_id TEXT,
  ingredient_id UUID REFERENCES public.ingredients(id),
  location_id UUID REFERENCES public.inv_locations(id),
  bin_id UUID REFERENCES public.inv_bins(id),
  count_uom TEXT,
  par_level NUMERIC,
  min_level NUMERIC,
  max_level NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT inv_location_assignments_unique UNIQUE (ingredient_id, location_id, bin_id)
);

-- Create device_assignments table for device to location mapping
CREATE TABLE public.device_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id TEXT,
  location_id UUID REFERENCES public.inv_locations(id),
  device_type TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create count_schedules table for scheduled inventory counts
CREATE TABLE public.count_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id TEXT,
  schedule_name TEXT NOT NULL,
  frequency TEXT NOT NULL,
  days_of_week JSONB DEFAULT '[]',
  location_ids JSONB DEFAULT '[]',
  due_time_local TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.inv_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.count_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for now, refine based on user requirements)
CREATE POLICY "Allow all operations on inv_locations" ON public.inv_locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on inv_bins" ON public.inv_bins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on inv_location_assignments" ON public.inv_location_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on device_assignments" ON public.device_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on count_schedules" ON public.count_schedules FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_inv_locations_venue ON public.inv_locations(venue_id, name);
CREATE INDEX idx_inv_locations_code ON public.inv_locations(venue_id, code);
CREATE INDEX idx_inv_locations_type ON public.inv_locations(venue_id, type);
CREATE INDEX idx_inv_locations_active ON public.inv_locations(venue_id, is_active);
CREATE INDEX idx_inv_bins_location ON public.inv_bins(location_id);
CREATE INDEX idx_inv_location_assignments_ingredient ON public.inv_location_assignments(ingredient_id);
CREATE INDEX idx_inv_location_assignments_location ON public.inv_location_assignments(location_id);
CREATE INDEX idx_device_assignments_venue ON public.device_assignments(venue_id);
CREATE INDEX idx_count_schedules_venue ON public.count_schedules(venue_id);

-- Create trigger to auto-update updated_at timestamp
CREATE TRIGGER update_inv_locations_updated_at
  BEFORE UPDATE ON public.inv_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inv_bins_updated_at
  BEFORE UPDATE ON public.inv_bins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inv_location_assignments_updated_at
  BEFORE UPDATE ON public.inv_location_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_device_assignments_updated_at
  BEFORE UPDATE ON public.device_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_count_schedules_updated_at
  BEFORE UPDATE ON public.count_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();