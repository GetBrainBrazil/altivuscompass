ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_archived_at ON public.quotes(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_lead_source ON public.quotes(lead_source) WHERE lead_source IS NOT NULL;