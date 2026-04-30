-- Tabela de observações (notas) por lead
CREATE TABLE public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  user_id uuid,
  user_name text,
  body text NOT NULL,
  is_imported boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_notes_lead_id_created ON public.lead_notes (lead_id, created_at DESC);

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ver
CREATE POLICY "Authenticated users can view lead_notes"
ON public.lead_notes FOR SELECT TO authenticated
USING (true);

-- Todos autenticados podem inserir (precisa setar user_id = auth.uid())
CREATE POLICY "Authenticated users can insert lead_notes"
ON public.lead_notes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Apenas o autor pode atualizar
CREATE POLICY "Authors can update own lead_notes"
ON public.lead_notes FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Autor, admin ou manager podem excluir
CREATE POLICY "Authors and admins can delete lead_notes"
ON public.lead_notes FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- Trigger updated_at
CREATE TRIGGER trg_lead_notes_updated_at
BEFORE UPDATE ON public.lead_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();