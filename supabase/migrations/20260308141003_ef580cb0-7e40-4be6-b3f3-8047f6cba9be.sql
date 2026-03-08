
-- New columns on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS rating integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepts_email_comm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_whatsapp_comm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS rg_issuer text,
  ADD COLUMN IF NOT EXISTS foreign_id text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS passport_number text,
  ADD COLUMN IF NOT EXISTS passport_issue_date date,
  ADD COLUMN IF NOT EXISTS passport_expiry_date date,
  ADD COLUMN IF NOT EXISTS passport_nationality text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text;

-- client_phones table
CREATE TABLE public.client_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  phone text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view client_phones" ON public.client_phones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client_phones" ON public.client_phones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client_phones" ON public.client_phones FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete client_phones" ON public.client_phones FOR DELETE TO authenticated USING (true);

-- client_emails table
CREATE TABLE public.client_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view client_emails" ON public.client_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client_emails" ON public.client_emails FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client_emails" ON public.client_emails FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete client_emails" ON public.client_emails FOR DELETE TO authenticated USING (true);

-- client_social_media table
CREATE TABLE public.client_social_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  network text NOT NULL,
  handle text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_social_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view client_social_media" ON public.client_social_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client_social_media" ON public.client_social_media FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client_social_media" ON public.client_social_media FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete client_social_media" ON public.client_social_media FOR DELETE TO authenticated USING (true);

-- client_visas table
CREATE TABLE public.client_visas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  visa_type text NOT NULL,
  validity_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_visas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view client_visas" ON public.client_visas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client_visas" ON public.client_visas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client_visas" ON public.client_visas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete client_visas" ON public.client_visas FOR DELETE TO authenticated USING (true);
