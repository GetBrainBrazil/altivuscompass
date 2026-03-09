
-- Add conclusion_type to quotes for won/lost tracking
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS conclusion_type TEXT DEFAULT NULL;

-- Create sales table (if not already created)
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'issued',
  destination TEXT,
  total_value NUMERIC DEFAULT 0,
  travel_date_start DATE,
  travel_date_end DATE,
  ticket_number TEXT,
  ticket_issued_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- RLS policies (use IF NOT EXISTS pattern)
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view sales" ON public.sales FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can update sales" ON public.sales FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Admins and managers can delete sales" ON public.sales FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migrate old stages to confirmed with conclusion_type
UPDATE public.quotes SET stage = 'confirmed', conclusion_type = 'won' WHERE stage IN ('issued', 'completed', 'post_sale');
