
-- Add extended fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS health_plan text;

-- Contract types enum
CREATE TYPE public.contract_type AS ENUM ('clt', 'pj', 'estagio', 'temporario', 'freelancer', 'outro');

-- User contracts table
CREATE TABLE public.user_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contract_type contract_type NOT NULL DEFAULT 'clt',
  start_date date NOT NULL,
  end_date date,
  signed_contract_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage user_contracts" ON public.user_contracts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own contracts" ON public.user_contracts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Contract documents table
CREATE TABLE public.user_contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.user_contracts(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_contract_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contract_documents" ON public.user_contract_documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own contract_documents" ON public.user_contract_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_contracts uc WHERE uc.id = contract_id AND uc.user_id = auth.uid()));

-- Contract compensations table
CREATE TABLE public.user_contract_compensations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.user_contracts(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric,
  start_date date NOT NULL,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_contract_compensations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contract_compensations" ON public.user_contract_compensations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own compensations" ON public.user_contract_compensations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_contracts uc WHERE uc.id = contract_id AND uc.user_id = auth.uid()));

-- Storage bucket for user documents
INSERT INTO storage.buckets (id, name, public) VALUES ('user-documents', 'user-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admins can manage user-documents" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'user-documents' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'user-documents' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Trigger for updated_at on user_contracts
CREATE TRIGGER update_user_contracts_updated_at
  BEFORE UPDATE ON public.user_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
