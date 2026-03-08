
-- Continents table
CREATE TABLE public.continents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.continents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view continents" ON public.continents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert continents" ON public.continents FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update continents" ON public.continents FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete continents" ON public.continents FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Link countries to continents
CREATE TABLE public.continent_countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  continent_id uuid NOT NULL REFERENCES public.continents(id) ON DELETE CASCADE,
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(continent_id, country_id)
);

ALTER TABLE public.continent_countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view continent_countries" ON public.continent_countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert continent_countries" ON public.continent_countries FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update continent_countries" ON public.continent_countries FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete continent_countries" ON public.continent_countries FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Custom destination groups (Diversos)
CREATE TABLE public.custom_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view custom_destinations" ON public.custom_destinations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert custom_destinations" ON public.custom_destinations FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update custom_destinations" ON public.custom_destinations FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete custom_destinations" ON public.custom_destinations FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Items in a custom destination group
CREATE TABLE public.custom_destination_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_destination_id uuid NOT NULL REFERENCES public.custom_destinations(id) ON DELETE CASCADE,
  item_type text NOT NULL, -- 'continent', 'country', 'state', 'city'
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(custom_destination_id, item_type, item_id)
);

ALTER TABLE public.custom_destination_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view custom_destination_items" ON public.custom_destination_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert custom_destination_items" ON public.custom_destination_items FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update custom_destination_items" ON public.custom_destination_items FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete custom_destination_items" ON public.custom_destination_items FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Add desired_destinations to clients (stores array of strings like "continent:id", "country:id", "custom:id", etc.)
ALTER TABLE public.clients ADD COLUMN desired_destinations text[] DEFAULT '{}'::text[];

-- Seed continents
INSERT INTO public.continents (name) VALUES
  ('África'), ('América Central'), ('América do Norte'), ('América do Sul'),
  ('Ásia'), ('Europa'), ('Oceania'), ('Oriente Médio');
