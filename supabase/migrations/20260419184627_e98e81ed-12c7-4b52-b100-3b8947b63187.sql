-- Novos campos em quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS close_probability TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS internal_due_date DATE;

CREATE INDEX IF NOT EXISTS idx_quotes_internal_due_date
  ON public.quotes(internal_due_date)
  WHERE internal_due_date IS NOT NULL;

-- Tabela quote_interactions
CREATE TABLE IF NOT EXISTS public.quote_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  interaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_interactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view quote_interactions"
    ON public.quote_interactions FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert quote_interactions"
    ON public.quote_interactions FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update quote_interactions"
    ON public.quote_interactions FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can delete quote_interactions"
    ON public.quote_interactions FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_quote_interactions_quote_id
  ON public.quote_interactions(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_interactions_date
  ON public.quote_interactions(interaction_date DESC);