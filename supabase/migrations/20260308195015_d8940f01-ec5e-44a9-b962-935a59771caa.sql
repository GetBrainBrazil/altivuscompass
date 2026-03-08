
-- Bank accounts table
CREATE TABLE public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name text NOT NULL,
  agency text,
  account_number text,
  account_type text DEFAULT 'checking',
  pix_key text,
  pix_key_type text,
  holder_name text,
  holder_document text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view bank_accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Admins can insert bank_accounts" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update bank_accounts" ON public.bank_accounts FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete bank_accounts" ON public.bank_accounts FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Chart of accounts / categories table (hierarchical)
CREATE TABLE public.financial_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text,
  type text NOT NULL DEFAULT 'expense',
  parent_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view financial_categories" ON public.financial_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert financial_categories" ON public.financial_categories FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update financial_categories" ON public.financial_categories FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete financial_categories" ON public.financial_categories FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
