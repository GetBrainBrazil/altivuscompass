ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS option_group TEXT,
  ADD COLUMN IF NOT EXISTS option_label TEXT,
  ADD COLUMN IF NOT EXISTS option_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quote_items_option_group
  ON public.quote_items(quote_id, option_group);