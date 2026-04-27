ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS budget_estimate numeric;
ALTER TABLE public.whatsapp_sessions ADD COLUMN IF NOT EXISTS lead_id uuid;
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON public.whatsapp_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_lead_id ON public.whatsapp_sessions(lead_id);