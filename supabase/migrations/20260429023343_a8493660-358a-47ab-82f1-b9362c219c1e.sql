ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_leads_archived ON public.leads(archived) WHERE archived = true;