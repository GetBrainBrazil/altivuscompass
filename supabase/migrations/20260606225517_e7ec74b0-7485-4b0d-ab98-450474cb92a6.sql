
-- ============================================================
-- Etapa 1: Persistir o pós-venda (ops_cards) no banco
-- ============================================================

-- 1) ops_cards
CREATE TABLE public.ops_cards (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id         UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  client_id          UUID REFERENCES public.clients(id)  ON DELETE SET NULL,
  quote_id           UUID REFERENCES public.quotes(id)   ON DELETE SET NULL,
  deal_id            UUID, -- preenchido na Etapa 3
  column_id          TEXT NOT NULL CHECK (column_id IN ('pre-trip','in-trip','support','post-trip')),
  sort_order         INTEGER NOT NULL DEFAULT 0,
  client_name        TEXT NOT NULL,
  destination        TEXT,
  travel_date        TEXT,
  travel_date_iso    DATE,
  agent_user_id      UUID,
  agent_name         TEXT,
  agent_avatar       TEXT,
  tags               JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_manual_lead     BOOLEAN NOT NULL DEFAULT false,
  stage_entered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at        TIMESTAMPTZ,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ops_cards_column_sort_idx     ON public.ops_cards (column_id, sort_order);
CREATE INDEX ops_cards_contact_idx         ON public.ops_cards (contact_id);
CREATE INDEX ops_cards_client_idx          ON public.ops_cards (client_id);
CREATE INDEX ops_cards_agent_idx           ON public.ops_cards (agent_user_id);
CREATE INDEX ops_cards_created_by_idx      ON public.ops_cards (created_by);
CREATE INDEX ops_cards_active_idx          ON public.ops_cards (column_id) WHERE archived_at IS NULL;

-- GRANTs (Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_cards TO authenticated;
GRANT ALL ON public.ops_cards TO service_role;

-- RLS
ALTER TABLE public.ops_cards ENABLE ROW LEVEL SECURITY;

-- Helper: pode ver/editar este card?
-- Gestor (admin/manager): tudo. Operações/agente: apenas os próprios.
CREATE OR REPLACE FUNCTION public.can_manage_ops_card(_agent_user_id UUID, _created_by UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR (_agent_user_id IS NOT NULL AND _agent_user_id = auth.uid())
    OR (_created_by   IS NOT NULL AND _created_by   = auth.uid());
$$;

CREATE POLICY "ops_cards select by role"
  ON public.ops_cards FOR SELECT
  TO authenticated
  USING (public.can_manage_ops_card(agent_user_id, created_by));

CREATE POLICY "ops_cards insert by role"
  ON public.ops_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'operations'::app_role)
    OR public.has_role(auth.uid(), 'sales_agent'::app_role)
  );

CREATE POLICY "ops_cards update by role"
  ON public.ops_cards FOR UPDATE
  TO authenticated
  USING (public.can_manage_ops_card(agent_user_id, created_by))
  WITH CHECK (public.can_manage_ops_card(agent_user_id, created_by));

CREATE POLICY "ops_cards delete by role"
  ON public.ops_cards FOR DELETE
  TO authenticated
  USING (public.can_manage_ops_card(agent_user_id, created_by));

-- updated_at trigger (reusa função existente)
CREATE TRIGGER trg_ops_cards_updated_at
  BEFORE UPDATE ON public.ops_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.ops_cards REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_cards;

-- ============================================================
-- 2) ops_migration_log — auditoria de importações localStorage
-- ============================================================
CREATE TABLE public.ops_migration_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,
  migrated_count  INTEGER NOT NULL DEFAULT 0,
  skipped_count   INTEGER NOT NULL DEFAULT 0,
  skipped_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,
  unparsed_dates  JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_payload  JSONB,
  notes           TEXT,
  migrated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ops_migration_log_user_idx ON public.ops_migration_log (user_id, migrated_at DESC);

GRANT SELECT, INSERT ON public.ops_migration_log TO authenticated;
GRANT ALL ON public.ops_migration_log TO service_role;

ALTER TABLE public.ops_migration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_migration_log insert self"
  ON public.ops_migration_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "ops_migration_log select self or admin"
  ON public.ops_migration_log FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );
