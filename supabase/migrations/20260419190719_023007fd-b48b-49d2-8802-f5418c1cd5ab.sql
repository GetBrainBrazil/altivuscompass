CREATE TABLE IF NOT EXISTS public.quote_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  accepter_name TEXT NOT NULL,
  accepter_email TEXT NOT NULL,
  accepter_phone TEXT NOT NULL,
  accepter_cpf TEXT NOT NULL,
  terms_accepted BOOLEAN NOT NULL DEFAULT false,
  selected_item_ids UUID[] DEFAULT '{}'::uuid[],
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_acceptances ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view quote_acceptances"
    ON public.quote_acceptances FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete quote_acceptances"
    ON public.quote_acceptances FOR DELETE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_quote_acceptances_quote_id
  ON public.quote_acceptances(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_acceptances_accepted_at
  ON public.quote_acceptances(accepted_at DESC);