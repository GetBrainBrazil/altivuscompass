CREATE TABLE public.lead_loss_reasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  user_id uuid,
  user_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_loss_reasons_lead_id ON public.lead_loss_reasons(lead_id);
CREATE INDEX idx_lead_loss_reasons_created_at ON public.lead_loss_reasons(created_at DESC);

ALTER TABLE public.lead_loss_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead_loss_reasons"
  ON public.lead_loss_reasons FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lead_loss_reasons"
  ON public.lead_loss_reasons FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Admins and managers can update lead_loss_reasons"
  ON public.lead_loss_reasons FOR UPDATE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins and managers can delete lead_loss_reasons"
  ON public.lead_loss_reasons FOR DELETE
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));