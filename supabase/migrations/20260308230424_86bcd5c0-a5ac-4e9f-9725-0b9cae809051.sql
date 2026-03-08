CREATE TABLE public.supplier_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  phone text NOT NULL,
  country_code text NOT NULL DEFAULT '+55',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.supplier_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  email text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view supplier_phones" ON public.supplier_phones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert supplier_phones" ON public.supplier_phones FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update supplier_phones" ON public.supplier_phones FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete supplier_phones" ON public.supplier_phones FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view supplier_emails" ON public.supplier_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert supplier_emails" ON public.supplier_emails FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update supplier_emails" ON public.supplier_emails FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete supplier_emails" ON public.supplier_emails FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));