ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS template_name TEXT;
CREATE INDEX IF NOT EXISTS idx_quotes_is_template ON public.quotes(is_template) WHERE is_template = true;