-- Add lost-state fields to leads table
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_lost boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_from_status text,
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS lost_details text;

-- Backfill: any existing leads with status='lost' become is_lost=true with snapshot
UPDATE public.leads
SET is_lost = true,
    lost_at = COALESCE(lost_at, updated_at, now()),
    lost_from_status = COALESCE(lost_from_status, 'quote'),
    status = 'quote'
WHERE status = 'lost';

CREATE INDEX IF NOT EXISTS idx_leads_is_lost ON public.leads(is_lost);
