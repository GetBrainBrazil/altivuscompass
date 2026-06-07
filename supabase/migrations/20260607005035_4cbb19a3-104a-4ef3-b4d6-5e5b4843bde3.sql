-- =========================================
-- ETAPA 5 — Dinheiro por Item + Devolução
-- =========================================

-- ===== 1. SNAPSHOTS PRÉ-MIGRAÇÃO =====
CREATE TABLE public.contacts_pre_etapa5    AS SELECT * FROM public.contacts;
CREATE TABLE public.quote_items_pre_etapa5 AS SELECT * FROM public.quote_items;
CREATE TABLE public.quotes_pre_etapa5      AS SELECT * FROM public.quotes;
CREATE TABLE public.deals_pre_etapa5       AS SELECT * FROM public.deals;
CREATE TABLE public.tasks_pre_etapa5       AS SELECT * FROM public.tasks;

GRANT SELECT ON public.contacts_pre_etapa5    TO service_role;
GRANT SELECT ON public.quote_items_pre_etapa5 TO service_role;
GRANT SELECT ON public.quotes_pre_etapa5      TO service_role;
GRANT SELECT ON public.deals_pre_etapa5       TO service_role;
GRANT SELECT ON public.tasks_pre_etapa5       TO service_role;

ALTER TABLE public.contacts_pre_etapa5    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items_pre_etapa5 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes_pre_etapa5      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals_pre_etapa5       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks_pre_etapa5       ENABLE ROW LEVEL SECURITY;

-- ===== 2. NOVAS COLUNAS =====
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount_allocated NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS utilization_start DATE,
  ADD COLUMN IF NOT EXISTS utilization_end DATE,
  ADD COLUMN IF NOT EXISTS return_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_reason TEXT;

ALTER TABLE public.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_return_status_chk;
ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_return_status_chk
  CHECK (return_status IN ('active','return_requested','returned'));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS quote_item_id UUID REFERENCES public.quote_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_quote_item_id
  ON public.tasks(quote_item_id) WHERE quote_item_id IS NOT NULL;

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS reverted_to_lead_at TIMESTAMPTZ;

-- ===== 3. PHASE_OF: incluir 'devolucao' =====
CREATE OR REPLACE FUNCTION public.deal_event_phase_of(_stage text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _stage
    WHEN 'new'         THEN 'quoting'
    WHEN 'sent'        THEN 'quoting'
    WHEN 'negotiation' THEN 'quoting'
    WHEN 'confirmed'   THEN 'selling'
    WHEN 'issued'      THEN 'selling'
    WHEN 'devolucao'   THEN 'selling'
    WHEN 'completed'   THEN 'fulfilling'
    WHEN 'post_sale'   THEN 'fulfilling'
    ELSE NULL
  END;
$$;

-- ===== 4. RECALC ALOCAÇÕES (Opção 2: Congelar) =====
CREATE OR REPLACE FUNCTION public.recalc_quote_item_allocations(_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_discount_amount NUMERIC;
  v_discount_percent NUMERIC;
  v_base NUMERIC;
  v_total_discount NUMERIC;
  v_frozen_sum NUMERIC;
  v_alive_base NUMERIC;
  v_remaining NUMERIC;
  v_has_returned BOOLEAN;
BEGIN
  IF _quote_id IS NULL THEN RETURN; END IF;

  SELECT discount_amount, discount_percent
    INTO v_discount_amount, v_discount_percent
  FROM public.quotes WHERE id = _quote_id;

  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_base
  FROM public.quote_items WHERE quote_id = _quote_id;

  -- XOR: amount OU percent (não somam)
  v_total_discount := COALESCE(
    NULLIF(v_discount_amount, 0),
    CASE WHEN COALESCE(v_discount_percent,0) > 0
         THEN v_base * v_discount_percent / 100.0
         ELSE 0 END
  );

  SELECT EXISTS (
    SELECT 1 FROM public.quote_items
    WHERE quote_id = _quote_id AND return_status = 'returned'
  ) INTO v_has_returned;

  IF NOT v_has_returned THEN
    IF v_base = 0 OR v_total_discount = 0 THEN
      UPDATE public.quote_items SET discount_amount_allocated = 0 WHERE quote_id = _quote_id;
    ELSE
      UPDATE public.quote_items qi
      SET discount_amount_allocated = ROUND(v_total_discount * (qi.quantity * qi.unit_price) / v_base, 2)
      WHERE qi.quote_id = _quote_id;
    END IF;
  ELSE
    -- Alocação dos devolvidos: CONGELADA (não tocar)
    SELECT COALESCE(SUM(discount_amount_allocated), 0) INTO v_frozen_sum
    FROM public.quote_items
    WHERE quote_id = _quote_id AND return_status = 'returned';

    SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_alive_base
    FROM public.quote_items
    WHERE quote_id = _quote_id AND return_status <> 'returned';

    v_remaining := GREATEST(v_total_discount - v_frozen_sum, 0);

    IF v_alive_base = 0 OR v_remaining = 0 THEN
      UPDATE public.quote_items SET discount_amount_allocated = 0
      WHERE quote_id = _quote_id AND return_status <> 'returned';
    ELSE
      UPDATE public.quote_items qi
      SET discount_amount_allocated = ROUND(v_remaining * (qi.quantity * qi.unit_price) / v_alive_base, 2)
      WHERE qi.quote_id = _quote_id AND qi.return_status <> 'returned';
    END IF;
  END IF;
END;
$$;

-- ===== 5. VIEW v_deal_totals (sempre lê do item) =====
DROP VIEW IF EXISTS public.v_deal_totals;
CREATE VIEW public.v_deal_totals AS
SELECT
  d.id AS deal_id,
  d.source_quote_id AS quote_id,
  COALESCE(SUM(CASE WHEN qi.return_status <> 'returned'
       THEN qi.quantity * qi.unit_price - qi.discount_amount_allocated - COALESCE(qi.discount_amount,0)
       ELSE 0 END), 0) AS net_revenue,
  COALESCE(SUM(qi.discount_amount_allocated + COALESCE(qi.discount_amount,0)), 0) AS total_discount,
  COALESCE(SUM(CASE WHEN qi.return_status <> 'returned'
       THEN (qi.quantity * qi.unit_price - qi.discount_amount_allocated - COALESCE(qi.discount_amount,0))
          - (qi.quantity * qi.unit_cost)
       ELSE 0 END), 0) AS margin,
  COALESCE(SUM(CASE WHEN qi.return_status <> 'returned'
       THEN qi.quantity * qi.unit_price - qi.discount_amount_allocated - COALESCE(qi.discount_amount,0)
       ELSE 0 END), 0) - COALESCE(SUM(qi.refunded_amount), 0) AS realized_net,
  COALESCE(SUM(CASE WHEN qi.return_status <> 'returned'
       THEN (qi.quantity * qi.unit_price - qi.discount_amount_allocated - COALESCE(qi.discount_amount,0))
          - (qi.quantity * qi.unit_cost)
       ELSE 0 END), 0) - COALESCE(SUM(qi.refunded_amount), 0) AS realized_margin,
  COUNT(*) FILTER (WHERE qi.return_status <> 'returned') AS active_items,
  COUNT(*) FILTER (WHERE qi.return_status = 'returned')   AS returned_items
FROM public.deals d
LEFT JOIN public.quote_items qi ON qi.deal_id = d.id
GROUP BY d.id, d.source_quote_id;

GRANT SELECT ON public.v_deal_totals TO authenticated, service_role;

-- ===== 6. VALIDAÇÃO utilization_start no fechamento =====
CREATE OR REPLACE FUNCTION public.validate_utilization_on_close()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_missing INT;
BEGIN
  IF NEW.stage::text IN ('confirmed','issued')
     AND OLD.stage::text NOT IN ('confirmed','issued') THEN
    SELECT COUNT(*) INTO v_missing
    FROM public.quote_items
    WHERE quote_id = NEW.id AND utilization_start IS NULL;
    IF v_missing > 0 THEN
      RAISE EXCEPTION 'Há % item(ns) sem data de utilização (utilization_start). Defina antes de fechar a cotação.', v_missing
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_validate_utilization ON public.quotes;
CREATE TRIGGER trg_quotes_validate_utilization
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.validate_utilization_on_close();

-- ===== 7. prevent_contact_level_regression: GUC + estado real =====
CREATE OR REPLACE FUNCTION public.prevent_contact_level_regression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_marker TEXT;
  v_deal_id UUID;
  v_belongs BOOLEAN := false;
  v_all_returned BOOLEAN := false;
BEGIN
  IF OLD.level = 'cliente' AND NEW.level <> 'cliente' THEN
    v_marker := COALESCE(current_setting('app.allow_client_revert', true), '');
    IF v_marker <> '' THEN
      BEGIN v_deal_id := v_marker::uuid; EXCEPTION WHEN OTHERS THEN v_deal_id := NULL; END;
      IF v_deal_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM public.deals d
          WHERE d.id = v_deal_id AND d.client_id = NEW.client_id
        ) INTO v_belongs;
        SELECT (
          EXISTS (SELECT 1 FROM public.quote_items WHERE deal_id = v_deal_id)
          AND NOT EXISTS (SELECT 1 FROM public.quote_items WHERE deal_id = v_deal_id AND return_status <> 'returned')
        ) INTO v_all_returned;
        IF v_belongs AND v_all_returned THEN
          RETURN NEW; -- regressão controlada permitida
        END IF;
      END IF;
    END IF;
    RAISE EXCEPTION 'O nível "Cliente" é permanente e não pode regredir para %.', NEW.level
      USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.level = 'lead' AND NEW.level = 'prospect' THEN
    NEW.level := 'lead';
  END IF;
  RETURN NEW;
END;
$$;

-- ===== 8. reverse_client_to_lead =====
CREATE OR REPLACE FUNCTION public.reverse_client_to_lead(
  _client_id uuid, _reason text, _deal_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
  v_other_alive UUID;
BEGIN
  IF _client_id IS NULL OR _deal_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_contact_id FROM public.contacts WHERE client_id = _client_id LIMIT 1;
  IF v_contact_id IS NULL THEN RETURN; END IF;

  -- OUTRO deal vivo? (qualquer fase com itens vivos OU sem itens devolvidos totalmente)
  SELECT d.id INTO v_other_alive
  FROM public.deals d
  WHERE d.client_id = _client_id
    AND d.id <> _deal_id
    AND (
      d.stage <> 'devolucao'
      OR EXISTS (SELECT 1 FROM public.quote_items qi WHERE qi.deal_id = d.id AND qi.return_status <> 'returned')
    )
  LIMIT 1;

  IF v_other_alive IS NOT NULL THEN
    INSERT INTO public.deal_events (deal_id, contact_id, event_type, reason_text, source, occurred_at, metadata)
    VALUES (_deal_id, v_contact_id, 'client_revert_skipped', _reason, 'trigger', now(),
            jsonb_build_object('other_alive_deal_id', v_other_alive, 'client_id', _client_id));
    RETURN;
  END IF;

  PERFORM set_config('app.allow_client_revert', _deal_id::text, true);
  BEGIN
    UPDATE public.contacts
    SET level = 'lead',
        reverted_to_lead_at = now(),
        updated_at = now()
    WHERE id = v_contact_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.allow_client_revert', '', true);
    RAISE;
  END;
  PERFORM set_config('app.allow_client_revert', '', true);

  INSERT INTO public.deal_events (deal_id, contact_id, event_type, reason_text, source, occurred_at, metadata)
  VALUES (_deal_id, v_contact_id, 'client_reverted', _reason, 'trigger', now(),
          jsonb_build_object('client_id', _client_id));
END;
$$;

-- ===== 9. trg_item_returned =====
CREATE OR REPLACE FUNCTION public.trg_fn_item_returned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id UUID;
  v_deal_id  UUID;
  v_client_id UUID;
  v_alive INT;
BEGIN
  IF NEW.return_status IS NOT DISTINCT FROM OLD.return_status THEN RETURN NEW; END IF;
  IF NEW.return_status <> 'returned' THEN RETURN NEW; END IF;
  IF OLD.return_status = 'returned' THEN RETURN NEW; END IF;

  NEW.returned_at := COALESCE(NEW.returned_at, now());
  v_quote_id := NEW.quote_id;
  v_deal_id  := NEW.deal_id;

  UPDATE public.tasks
  SET status = 'cancelled', updated_at = now()
  WHERE quote_item_id = NEW.id
    AND status NOT IN ('done','cancelled');

  INSERT INTO public.deal_events (deal_id, quote_id, event_type, amount, reason_text, source, occurred_at, metadata)
  VALUES (v_deal_id, v_quote_id, 'item_returned',
          NEW.refunded_amount, NEW.return_reason, 'trigger', now(),
          jsonb_build_object('quote_item_id', NEW.id, 'title', NEW.title));

  PERFORM public.recalc_quote_item_allocations(v_quote_id);

  IF v_deal_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_alive
    FROM public.quote_items
    WHERE deal_id = v_deal_id
      AND return_status <> 'returned'
      AND id <> NEW.id;

    IF v_alive = 0 THEN
      SELECT client_id INTO v_client_id FROM public.deals WHERE id = v_deal_id;

      UPDATE public.deals
      SET phase = 'selling'::deal_phase, stage = 'devolucao', updated_at = now()
      WHERE id = v_deal_id;

      INSERT INTO public.deal_events (deal_id, event_type, to_phase, to_stage, source, occurred_at, metadata)
      VALUES (v_deal_id, 'deal_fully_returned', 'selling', 'devolucao', 'trigger', now(),
              jsonb_build_object('client_id', v_client_id));

      IF v_client_id IS NOT NULL THEN
        PERFORM public.reverse_client_to_lead(v_client_id, COALESCE(NEW.return_reason, 'Devolução total'), v_deal_id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_item_returned ON public.quote_items;
CREATE TRIGGER trg_item_returned
BEFORE UPDATE OF return_status ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_item_returned();

-- ===== 10. SMOKE TEST =====
CREATE OR REPLACE FUNCTION public.test_etapa5_smoke()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client UUID; v_contact UUID;
  v_quote UUID; v_deal UUID; v_item_a UUID; v_item_b UUID; v_task UUID;
  v_quote2 UUID; v_deal2 UUID; v_item_c UUID;
  v_log JSONB := '[]'::jsonb;
  v_stage TEXT; v_phase TEXT; v_level TEXT; v_task_status TEXT;
  v_cnt INT;
BEGIN
  -- SETUP
  INSERT INTO public.clients (full_name, phone, email)
  VALUES ('SMOKE Etapa5','+5511999990000','smoke_etapa5@test.local') RETURNING id INTO v_client;

  -- sync_contact_from_client cria o contato como cliente
  SELECT id INTO v_contact FROM public.contacts WHERE client_id = v_client LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO public.contacts (level, full_name, phone, client_id, source, promoted_to_cliente_at)
    VALUES ('cliente','SMOKE Etapa5','+5511999990000', v_client, 'manual', now()) RETURNING id INTO v_contact;
  END IF;

  INSERT INTO public.quotes (title, client_id, stage, total_value, conclusion_type)
  VALUES ('SMOKE Q1', v_client, 'confirmed'::quote_stage, 10000, 'won') RETURNING id INTO v_quote;
  SELECT id INTO v_deal FROM public.deals WHERE source_quote_id = v_quote;

  INSERT INTO public.quote_items (quote_id, deal_id, item_type, title, quantity, unit_cost, unit_price, utilization_start)
  VALUES (v_quote, v_deal, 'flight','Voo SMOKE',1,2000,5000,'2026-12-01') RETURNING id INTO v_item_a;
  INSERT INTO public.quote_items (quote_id, deal_id, item_type, title, quantity, unit_cost, unit_price, utilization_start)
  VALUES (v_quote, v_deal, 'hotel','Hotel SMOKE',1,1500,5000,'2026-12-01') RETURNING id INTO v_item_b;

  INSERT INTO public.tasks (title, quote_id, quote_item_id, status)
  VALUES ('Task voo', v_quote, v_item_a, 'todo') RETURNING id INTO v_task;

  -- CENÁRIO 1: DEVOLUÇÃO PARCIAL
  UPDATE public.quote_items
    SET return_status='returned', refunded_amount=5000, return_reason='Teste parcial'
    WHERE id = v_item_a;

  SELECT status INTO v_task_status FROM public.tasks WHERE id = v_task;
  IF v_task_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL parcial: task não cancelada (status=%)', v_task_status; END IF;
  v_log := v_log || jsonb_build_object('parcial_task_cancelled', true);

  SELECT COUNT(*) INTO v_cnt FROM public.deal_events WHERE deal_id=v_deal AND event_type='item_returned';
  IF v_cnt < 1 THEN RAISE EXCEPTION 'FAIL parcial: evento item_returned não registrado'; END IF;
  v_log := v_log || jsonb_build_object('parcial_evt_item_returned', v_cnt);

  SELECT stage, phase::text INTO v_stage, v_phase FROM public.deals WHERE id=v_deal;
  IF v_stage = 'devolucao' THEN RAISE EXCEPTION 'FAIL parcial: deal mudou para devolucao indevidamente'; END IF;
  v_log := v_log || jsonb_build_object('parcial_deal_stage', v_stage, 'parcial_deal_phase', v_phase);

  SELECT level::text INTO v_level FROM public.contacts WHERE id=v_contact;
  IF v_level <> 'cliente' THEN RAISE EXCEPTION 'FAIL parcial: contato regrediu (level=%)', v_level; END IF;
  v_log := v_log || jsonb_build_object('parcial_level', v_level);

  -- CENÁRIO 2: OUTRO DEAL VIVO + DEVOLUÇÃO TOTAL → client_revert_skipped
  INSERT INTO public.quotes (title, client_id, stage, total_value, conclusion_type)
  VALUES ('SMOKE Q2', v_client, 'confirmed'::quote_stage, 8000, 'won') RETURNING id INTO v_quote2;
  SELECT id INTO v_deal2 FROM public.deals WHERE source_quote_id = v_quote2;
  INSERT INTO public.quote_items (quote_id, deal_id, item_type, title, quantity, unit_cost, unit_price, utilization_start)
  VALUES (v_quote2, v_deal2, 'flight','Voo Q2',1,1000,4000,'2027-01-01') RETURNING id INTO v_item_c;

  UPDATE public.quote_items
    SET return_status='returned', refunded_amount=5000, return_reason='Teste total'
    WHERE id = v_item_b;

  SELECT stage, phase::text INTO v_stage, v_phase FROM public.deals WHERE id=v_deal;
  IF v_stage <> 'devolucao' OR v_phase <> 'selling' THEN
    RAISE EXCEPTION 'FAIL total: deal não foi para devolucao/selling (stage=% phase=%)', v_stage, v_phase;
  END IF;
  v_log := v_log || jsonb_build_object('total_deal_stage', v_stage, 'total_deal_phase', v_phase);

  SELECT COUNT(*) INTO v_cnt FROM public.deal_events WHERE deal_id=v_deal AND event_type='deal_fully_returned';
  IF v_cnt < 1 THEN RAISE EXCEPTION 'FAIL total: deal_fully_returned não registrado'; END IF;
  v_log := v_log || jsonb_build_object('total_evt_fully_returned', v_cnt);

  SELECT COUNT(*) INTO v_cnt FROM public.deal_events WHERE deal_id=v_deal AND event_type='client_revert_skipped';
  IF v_cnt < 1 THEN RAISE EXCEPTION 'FAIL total: client_revert_skipped esperado (outro deal vivo)'; END IF;
  v_log := v_log || jsonb_build_object('total_evt_revert_skipped', v_cnt);

  SELECT level::text INTO v_level FROM public.contacts WHERE id=v_contact;
  IF v_level <> 'cliente' THEN RAISE EXCEPTION 'FAIL total: contato NÃO devia regredir (level=%)', v_level; END IF;
  v_log := v_log || jsonb_build_object('after_skipped_level', v_level);

  -- CENÁRIO 3: devolução total do deal2 → agora reverte
  UPDATE public.quote_items
    SET return_status='returned', refunded_amount=4000, return_reason='Teste total 2'
    WHERE id = v_item_c;

  SELECT COUNT(*) INTO v_cnt FROM public.deal_events WHERE deal_id=v_deal2 AND event_type='client_reverted';
  IF v_cnt < 1 THEN RAISE EXCEPTION 'FAIL revert: client_reverted não emitido'; END IF;
  v_log := v_log || jsonb_build_object('revert_evt_count', v_cnt);

  SELECT level::text INTO v_level FROM public.contacts WHERE id=v_contact;
  IF v_level <> 'lead' THEN RAISE EXCEPTION 'FAIL revert: contato não regrediu para lead (level=%)', v_level; END IF;
  v_log := v_log || jsonb_build_object('final_level', v_level);

  -- CLEANUP
  DELETE FROM public.tasks       WHERE quote_id IN (v_quote, v_quote2);
  DELETE FROM public.deal_events WHERE deal_id  IN (v_deal,  v_deal2);
  DELETE FROM public.quote_items WHERE quote_id IN (v_quote, v_quote2);
  DELETE FROM public.quotes      WHERE id       IN (v_quote, v_quote2);
  DELETE FROM public.contacts    WHERE id = v_contact;
  DELETE FROM public.clients     WHERE id = v_client;

  RETURN jsonb_build_object('status','PASS','log', v_log);
END;
$$;

-- ===== 11. CHANGELOG =====
INSERT INTO public.platform_changelog (title, description, category, module, date)
VALUES (
  'Etapa 5: Dinheiro por Item + Ciclo de Devolução',
  E'Implementado o módulo financeiro por item e o ciclo de devolução:\n\n• Novas colunas em itens (discount_amount/allocated, utilization_start/end, return_status, refunded_amount, return_reason).\n• Rateio congelado (Opção 2): após primeira devolução, a alocação dos devolvidos vira definitiva — itens vivos não têm margem mexida por evento externo.\n• View v_deal_totals lê SEMPRE do item (net_revenue, total_discount, margin, realized_net/margin, active/returned counts).\n• Validação no banco: transição de cotação para confirmado/emitido bloqueada se algum item estiver sem data de utilização.\n• Ciclo de devolução: trigger cancela tasks do item, registra item_returned, e em devolução total move deal para stage=devolucao (phase=selling).\n• Reversão Cliente→Lead controlada por GUC + estado verificável (deal pertence ao cliente E todos os itens devolvidos). Se houver OUTRO deal vivo do cliente, emite client_revert_skipped.\n• Edge accept-quote, triggers de sync da Etapa 3 e demais triggers de negócio INTOCADOS.\n• Smoke test test_etapa5_smoke() cobre parcial, outro-deal-vivo (skip) e regressão real.',
  'nova_funcionalidade',
  'Financeiro',
  now()
);