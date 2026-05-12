CREATE TABLE IF NOT EXISTS public.ai_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Atendente Principal',
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  personality TEXT,
  rules TEXT,
  tone TEXT,
  icon TEXT,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agents read authenticated"
  ON public.ai_agents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "ai_agents insert admin/manager"
  ON public.ai_agents FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "ai_agents update admin/manager"
  ON public.ai_agents FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "ai_agents delete admin"
  ON public.ai_agents FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ai_agents_updated
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_agents (id, name, model, personality, rules, tone, icon, description)
VALUES ('1', 'Atendente Principal', 'google/gemini-2.5-flash',
  'Você é o atendente principal da Altivus Turismo. Recepcione clientes com cordialidade e identifique rapidamente o tipo de demanda.',
  '- Nunca compartilhe preços sem validação\n- Transfira para humano em reclamações\n- Não responda fora do escopo de viagens',
  'amigavel', 'bot', '')
ON CONFLICT (id) DO NOTHING;