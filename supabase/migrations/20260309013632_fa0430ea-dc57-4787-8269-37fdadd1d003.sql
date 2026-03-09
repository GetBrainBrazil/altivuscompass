
CREATE TABLE public.agency_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  cnpj text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  instagram text DEFAULT '',
  website text DEFAULT '',
  logo_url text DEFAULT '',
  address text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view agency_settings"
  ON public.agency_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage agency_settings"
  ON public.agency_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.agency_settings (name, cnpj, phone, email, instagram)
VALUES ('Altivus Turismo', '63.285.113/0001-09', '(21) 97544-8338', 'comercial@altivusturismo.com.br', 'altivusturismo');
