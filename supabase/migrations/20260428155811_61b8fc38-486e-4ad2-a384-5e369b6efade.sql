CREATE TABLE public.lead_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT,
  action TEXT NOT NULL,
  description TEXT,
  from_stage TEXT,
  to_stage TEXT,
  forced BOOLEAN NOT NULL DEFAULT false,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_history_lead_id ON public.lead_history(lead_id);
CREATE INDEX idx_lead_history_created_at ON public.lead_history(created_at DESC);

ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead_history"
  ON public.lead_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lead_history"
  ON public.lead_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins and managers can delete lead_history"
  ON public.lead_history FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));