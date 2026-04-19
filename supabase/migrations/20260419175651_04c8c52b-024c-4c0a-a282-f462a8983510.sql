-- 1) Novas colunas em quote_items
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS payment_source TEXT;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'pending';
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] DEFAULT '{}'::text[];
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS external_url TEXT;

-- 2) Novas colunas em quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;

-- 3) Storage bucket privado para anexos de itens
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-item-attachments', 'quote-item-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Policies (idempotentes via DO blocks)
DO $$ BEGIN
  CREATE POLICY "Authenticated can view quote item attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'quote-item-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can upload quote item attachments"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'quote-item-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can update quote item attachments"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'quote-item-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can delete quote item attachments"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'quote-item-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Índices
CREATE INDEX IF NOT EXISTS idx_quote_items_supplier_id
  ON public.quote_items(supplier_id) WHERE supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_payment_source
  ON public.quote_items(payment_source) WHERE payment_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_commission_status
  ON public.quote_items(commission_status) WHERE commission_status IS NOT NULL;