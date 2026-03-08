
-- Create client_passports table
CREATE TABLE public.client_passports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  passport_number text,
  issue_date date,
  expiry_date date,
  nationality text,
  status text DEFAULT 'valid',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_passports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view client_passports" ON public.client_passports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client_passports" ON public.client_passports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client_passports" ON public.client_passports FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete client_passports" ON public.client_passports FOR DELETE TO authenticated USING (true);

-- Add passport_id to client_visas so visas belong to a passport
ALTER TABLE public.client_visas ADD COLUMN passport_id uuid REFERENCES public.client_passports(id) ON DELETE CASCADE;
ALTER TABLE public.client_visas ALTER COLUMN client_id DROP NOT NULL;
