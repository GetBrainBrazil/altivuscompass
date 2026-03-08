
CREATE TABLE public.airports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iata_code text NOT NULL UNIQUE,
  name text NOT NULL,
  city text NOT NULL,
  state text,
  country text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view airports" ON public.airports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert airports" ON public.airports FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update airports" ON public.airports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete airports" ON public.airports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.airlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  iata_code text UNIQUE,
  country text,
  mileage_program_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.airlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view airlines" ON public.airlines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert airlines" ON public.airlines FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update airlines" ON public.airlines FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete airlines" ON public.airlines FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
