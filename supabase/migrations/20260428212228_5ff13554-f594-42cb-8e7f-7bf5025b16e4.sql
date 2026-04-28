ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS trip_profile text CHECK (trip_profile IN ('economico','conforto','premium')),
  ADD COLUMN IF NOT EXISTS lead_temperature text CHECK (lead_temperature IN ('hot','warm','cold')),
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON public.leads(assigned_user_id);