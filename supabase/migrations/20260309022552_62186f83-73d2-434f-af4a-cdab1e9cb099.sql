
CREATE TABLE public.quote_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT,
  action TEXT NOT NULL,
  description TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quote_history"
  ON public.quote_history FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert quote_history"
  ON public.quote_history FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_quote_history_quote_id ON public.quote_history(quote_id);
CREATE INDEX idx_quote_history_created_at ON public.quote_history(created_at DESC);
