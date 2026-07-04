
-- ============================================================
-- FASE 1 — Fluxo linear único + histórico de movimentações
-- ============================================================
-- Objetivos:
--   1. Adicionar coluna `situation` (badges paralelas à etapa) em deals
--   2. Criar tabela deal_stage_history para medir tempo por etapa (com retornos)
--   3. Criar trigger que mantém histórico em sincronia com deals.stage/phase
--   4. Criar view deal_stage_metrics agregada
--   5. Backfill inicial do histórico com deals existentes
-- ============================================================

-- 1) Coluna `situation` como array de badges (lost, paused, on_hold_client, contested, returned_flag)
--    Perdido deixa de ser etapa e vira badge que pode conviver com qualquer stage.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS situation TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

COMMENT ON COLUMN public.deals.situation IS
  'Badges paralelas à etapa: lost | paused | on_hold_client | contested | returned_flag';

-- 2) Tabela de histórico de movimentações entre etapas
CREATE TABLE IF NOT EXISTS public.deal_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  phase public.deal_phase NOT NULL,
  stage TEXT NOT NULL,
  from_phase public.deal_phase,
  from_stage TEXT,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at TIMESTAMPTZ,
  duration_seconds INTEGER GENERATED ALWAYS AS (
    CASE WHEN exited_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (exited_at - entered_at))::INTEGER
      ELSE NULL
    END
  ) STORED,
  moved_by UUID REFERENCES auth.users(id),
  moved_by_name TEXT,
  reason TEXT,
  source TEXT NOT NULL DEFAULT 'trigger',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dsh_deal_id ON public.deal_stage_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_dsh_deal_open ON public.deal_stage_history(deal_id) WHERE exited_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dsh_stage ON public.deal_stage_history(stage);
CREATE INDEX IF NOT EXISTS idx_dsh_phase ON public.deal_stage_history(phase);
CREATE INDEX IF NOT EXISTS idx_dsh_entered_at ON public.deal_stage_history(entered_at DESC);

-- Garantia: no máximo 1 linha em aberto por deal
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dsh_open_per_deal
  ON public.deal_stage_history(deal_id) WHERE exited_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.deal_stage_history TO authenticated;
GRANT ALL ON public.deal_stage_history TO service_role;

ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

-- Ver histórico segue as mesmas regras de leitura de deals
DROP POLICY IF EXISTS "dsh admins/managers full" ON public.deal_stage_history;
CREATE POLICY "dsh admins/managers full"
  ON public.deal_stage_history
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

DROP POLICY IF EXISTS "dsh own read" ON public.deal_stage_history;
CREATE POLICY "dsh own read"
  ON public.deal_stage_history FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deals d
    WHERE d.id = deal_stage_history.deal_id
      AND (d.assigned_to = auth.uid() OR d.created_by = auth.uid())
  ));

-- 3) Trigger que mantém histórico consistente
CREATE OR REPLACE FUNCTION public.trg_fn_deals_stage_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
  v_stage_changed BOOLEAN;
  v_phase_changed BOOLEAN;
BEGIN
  v_user_name := public.current_user_display_name();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.deal_stage_history (
      deal_id, phase, stage, entered_at, moved_by, moved_by_name, source
    ) VALUES (
      NEW.id, NEW.phase, NEW.stage, COALESCE(NEW.created_at, now()),
      COALESCE(NEW.created_by, auth.uid()), v_user_name, 'trigger'
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_stage_changed := NEW.stage IS DISTINCT FROM OLD.stage;
    v_phase_changed := NEW.phase IS DISTINCT FROM OLD.phase;

    -- Arquivamento fecha a linha em aberto
    IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
      UPDATE public.deal_stage_history
      SET exited_at = COALESCE(exited_at, NEW.archived_at, now()),
          metadata = metadata || jsonb_build_object('closed_by', 'archived')
      WHERE deal_id = NEW.id AND exited_at IS NULL;
      RETURN NEW;
    END IF;

    -- Desarquivamento reabre com nova linha
    IF NEW.archived_at IS NULL AND OLD.archived_at IS NOT NULL THEN
      INSERT INTO public.deal_stage_history (
        deal_id, phase, stage, from_phase, from_stage, moved_by, moved_by_name, source, reason
      ) VALUES (
        NEW.id, NEW.phase, NEW.stage, OLD.phase, OLD.stage,
        auth.uid(), v_user_name, 'trigger', 'unarchived'
      );
      RETURN NEW;
    END IF;

    IF v_stage_changed OR v_phase_changed THEN
      -- Fecha a linha atual
      UPDATE public.deal_stage_history
      SET exited_at = now()
      WHERE deal_id = NEW.id AND exited_at IS NULL;

      -- Abre nova linha (mesmo se voltar a etapa já visitada — cria nova entry)
      INSERT INTO public.deal_stage_history (
        deal_id, phase, stage, from_phase, from_stage, moved_by, moved_by_name, source
      ) VALUES (
        NEW.id, NEW.phase, NEW.stage, OLD.phase, OLD.stage,
        auth.uid(), v_user_name, 'trigger'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_stage_history ON public.deals;
CREATE TRIGGER trg_deals_stage_history
  AFTER INSERT OR UPDATE OF stage, phase, archived_at
  ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_deals_stage_history();

-- 4) View de métricas agregadas por deal/etapa
CREATE OR REPLACE VIEW public.deal_stage_metrics AS
SELECT
  deal_id,
  phase,
  stage,
  COUNT(*) AS passages,
  SUM(COALESCE(duration_seconds, EXTRACT(EPOCH FROM (now() - entered_at))::INTEGER)) AS total_seconds,
  MIN(entered_at) AS first_entered_at,
  MAX(entered_at) AS last_entered_at,
  MAX(exited_at) FILTER (WHERE exited_at IS NOT NULL) AS last_exited_at,
  BOOL_OR(exited_at IS NULL) AS is_current
FROM public.deal_stage_history
GROUP BY deal_id, phase, stage;

GRANT SELECT ON public.deal_stage_metrics TO authenticated, service_role;

-- 5) Backfill: cria linha em aberto pra cada deal sem histórico
INSERT INTO public.deal_stage_history (deal_id, phase, stage, entered_at, source, reason)
SELECT d.id, d.phase, d.stage, d.created_at, 'backfill', 'initial import'
FROM public.deals d
LEFT JOIN public.deal_stage_history h ON h.deal_id = d.id
WHERE h.id IS NULL
  AND d.archived_at IS NULL;

-- Fecha linhas de deals já arquivados
INSERT INTO public.deal_stage_history (deal_id, phase, stage, entered_at, exited_at, source, reason)
SELECT d.id, d.phase, d.stage, d.created_at, d.archived_at, 'backfill', 'initial import (archived)'
FROM public.deals d
LEFT JOIN public.deal_stage_history h ON h.deal_id = d.id
WHERE h.id IS NULL
  AND d.archived_at IS NOT NULL;
