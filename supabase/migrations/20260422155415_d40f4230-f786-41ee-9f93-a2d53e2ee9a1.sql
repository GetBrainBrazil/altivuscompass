-- 1. Tabela de anexos
CREATE TABLE public.quote_item_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_item_id uuid NOT NULL REFERENCES public.quote_items(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  original_name text,
  mime_type text,
  size_bytes bigint,
  is_public boolean NOT NULL DEFAULT false,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_item_attachments_item ON public.quote_item_attachments(quote_item_id);
CREATE INDEX idx_quote_item_attachments_quote ON public.quote_item_attachments(quote_id);
CREATE INDEX idx_quote_item_attachments_public ON public.quote_item_attachments(is_public) WHERE is_public = true;

ALTER TABLE public.quote_item_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quote_item_attachments"
  ON public.quote_item_attachments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert quote_item_attachments"
  ON public.quote_item_attachments FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update quote_item_attachments"
  ON public.quote_item_attachments FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated can delete quote_item_attachments"
  ON public.quote_item_attachments FOR DELETE
  TO authenticated USING (true);

-- Anexos públicos visíveis na página pública da cotação
CREATE POLICY "Public can view client-visible attachments"
  ON public.quote_item_attachments FOR SELECT
  TO anon USING (is_public = true);

-- 2. Storage policies para o bucket quote-item-attachments
-- (bucket já existe e é privado)
CREATE POLICY "Authenticated can read quote-item-attachments objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'quote-item-attachments');

CREATE POLICY "Authenticated can upload quote-item-attachments objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'quote-item-attachments');

CREATE POLICY "Authenticated can update quote-item-attachments objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'quote-item-attachments');

CREATE POLICY "Authenticated can delete quote-item-attachments objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'quote-item-attachments');

-- Visitantes anônimos podem baixar arquivos marcados como públicos na tabela
CREATE POLICY "Anon can read public quote-item-attachments objects"
  ON storage.objects FOR SELECT
  TO anon
  USING (
    bucket_id = 'quote-item-attachments'
    AND EXISTS (
      SELECT 1 FROM public.quote_item_attachments qia
      WHERE qia.file_path = storage.objects.name AND qia.is_public = true
    )
  );