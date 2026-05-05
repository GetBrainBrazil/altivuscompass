-- AI agent operational status (singleton row keyed by agent_id text)
CREATE TABLE IF NOT EXISTS public.ai_agent_status (
  agent_id TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.ai_agent_status ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (UI needs this and webhook uses service role)
CREATE POLICY "Authenticated can read agent status"
  ON public.ai_agent_status FOR SELECT
  TO authenticated USING (true);

-- Only admins/managers can write
CREATE POLICY "Admins/managers can insert agent status"
  ON public.ai_agent_status FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins/managers can update agent status"
  ON public.ai_agent_status FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_ai_agent_status_updated
  BEFORE UPDATE ON public.ai_agent_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the default agent as active
INSERT INTO public.ai_agent_status (agent_id, active)
VALUES ('1', true)
ON CONFLICT (agent_id) DO NOTHING;