
CREATE TABLE public.wa_message_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.wa_messages(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  receivable_id UUID,
  post_sale_id UUID,
  link_kind TEXT NOT NULL DEFAULT 'quote',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wa_message_links_at_least_one CHECK (
    quote_id IS NOT NULL OR receivable_id IS NOT NULL OR post_sale_id IS NOT NULL
  ),
  CONSTRAINT wa_message_links_unique UNIQUE (message_id, quote_id, receivable_id, post_sale_id)
);

CREATE INDEX idx_wa_message_links_message ON public.wa_message_links(message_id);
CREATE INDEX idx_wa_message_links_quote ON public.wa_message_links(quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX idx_wa_message_links_receivable ON public.wa_message_links(receivable_id) WHERE receivable_id IS NOT NULL;
CREATE INDEX idx_wa_message_links_post_sale ON public.wa_message_links(post_sale_id) WHERE post_sale_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_message_links TO authenticated;
GRANT ALL ON public.wa_message_links TO service_role;

ALTER TABLE public.wa_message_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read wa_message_links"
  ON public.wa_message_links FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert wa_message_links"
  ON public.wa_message_links FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete wa_message_links"
  ON public.wa_message_links FOR DELETE
  TO authenticated USING (auth.uid() IS NOT NULL);
