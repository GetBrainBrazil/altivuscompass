
CREATE TABLE public.client_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_name TEXT,
  kind TEXT NOT NULL DEFAULT 'note',
  content TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_interactions_contact ON public.client_interactions(contact_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_interactions TO authenticated;
GRANT ALL ON public.client_interactions TO service_role;

ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read interactions"
  ON public.client_interactions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can create interactions"
  ON public.client_interactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Author or admin can update"
  ON public.client_interactions FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Author or admin can delete"
  ON public.client_interactions FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

CREATE TRIGGER update_client_interactions_updated_at
  BEFORE UPDATE ON public.client_interactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
