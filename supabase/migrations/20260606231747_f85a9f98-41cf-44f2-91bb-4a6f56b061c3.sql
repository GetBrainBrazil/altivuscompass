
-- =========================================================================
-- ETAPA 2 — deal_events: log unificado (fundação de métricas)
-- =========================================================================
-- Ajuste aplicado: NENHUM trigger é desabilitado. Criamos a tabela,
-- rodamos o backfill (nenhum trigger de log existe ainda) e SÓ DEPOIS
-- criamos os triggers de log. Triggers de negócio existentes ficam intactos.
-- =========================================================================

-- ---------- 1. Helper: mapeamento stage -> phase --------------------------
CREATE OR REPLACE FUNCTION public.deal_event_phase_of(_stage text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE _stage
    WHEN 'new'         THEN 'quoting'
    WHEN 'sent'        THEN 'quoting'
    WHEN 'negotiation' THEN 'quoting'
    WHEN 'confirmed'   THEN 'selling'
    WHEN 'issued'      THEN 'selling'
    WHEN 'completed'   THEN 'fulfilling'
    WHEN 'post_sale'   THEN 'fulfilling'
    ELSE NULL
  END;
$$;

-- ---------- 2. Tabela deal_events ----------------------------------------
CREATE TABLE public.deal_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ponte de entidade (deal_id será preenchido na Etapa 3)
  deal_id      uuid NULL,
  quote_id     uuid NULL REFERENCES public.quotes(id)       ON DELETE SET NULL,
  sale_id      uuid NULL REFERENCES public.sales(id)        ON DELETE SET NULL,
  item_id      uuid NULL REFERENCES public.quote_items(id)  ON DELETE SET NULL,
  contact_id   uuid NULL REFERENCES public.contacts(id)     ON DELETE SET NULL,
  lead_id      uuid NULL REFERENCES public.leads(id)        ON DELETE SET NULL,

  -- O evento
  event_type   text NOT NULL,
  from_phase   text NULL,
  to_phase     text NULL,
  from_stage   text NULL,
  to_stage     text NULL,
  amount       numeric(14,2) NULL,
  currency     text NULL DEFAULT 'BRL',
  reason_code  text NULL,
  reason_text  text NULL,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Quem/quando/como
  user_id      uuid NULL,
  user_name    text NULL,
  source       text NOT NULL DEFAULT 'trigger',
  occurred_at  timestamptz NOT NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now(),

  -- Dedup (apenas backfill preenche; triggers deixam NULL)
  dedup_key    text NULL,

  CONSTRAINT deal_events_has_reference CHECK (
    deal_id IS NOT NULL OR quote_id IS NOT NULL OR sale_id IS NOT NULL OR contact_id IS NOT NULL
  ),
  CONSTRAINT deal_events_event_type_known CHECK (event_type IN (
    'deal_created','phase_changed','stage_changed',
    'quote_sent','quote_accepted','quote_lost',
    'quote_archived','quote_unarchived',
    'sale_created','sale_stage_changed',
    'item_added','item_updated','item_removed','item_returned',
    'client_promoted','client_reverted'
  )),
  CONSTRAINT deal_events_source_known CHECK (source IN (
    'trigger','backfill','edge:accept-quote','manual'
  ))
);

CREATE UNIQUE INDEX deal_events_dedup_key_uniq
  ON public.deal_events(dedup_key) WHERE dedup_key IS NOT NULL;
CREATE INDEX deal_events_deal_idx       ON public.deal_events(deal_id, occurred_at);
CREATE INDEX deal_events_quote_idx      ON public.deal_events(quote_id, occurred_at);
CREATE INDEX deal_events_sale_idx       ON public.deal_events(sale_id, occurred_at);
CREATE INDEX deal_events_type_time_idx  ON public.deal_events(event_type, occurred_at);
CREATE INDEX deal_events_occurred_idx   ON public.deal_events(occurred_at DESC);

-- ---------- 3. Grants + RLS ----------------------------------------------
GRANT SELECT ON public.deal_events TO authenticated;
GRANT ALL    ON public.deal_events TO service_role;

ALTER TABLE public.deal_events ENABLE ROW LEVEL SECURITY;

-- Admin/manager leem tudo
CREATE POLICY "deal_events_admin_manager_read"
ON public.deal_events FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- Agentes leem eventos das cotações/vendas que criaram ou estão atribuídos
CREATE POLICY "deal_events_owner_read"
ON public.deal_events FOR SELECT
TO authenticated
USING (
  (quote_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = deal_events.quote_id
      AND (q.assigned_to = auth.uid() OR q.created_by = auth.uid())
  ))
  OR
  (sale_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = deal_events.sale_id
      AND (s.assigned_to = auth.uid() OR s.created_by = auth.uid())
  ))
);

-- Nenhuma policy de INSERT/UPDATE/DELETE para authenticated:
-- só service_role e funções SECURITY DEFINER (triggers/backfill) escrevem.

-- ---------- 4. Log auxiliar de execuções de backfill ---------------------
CREATE TABLE public.deal_events_backfill_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at       timestamptz NOT NULL DEFAULT now(),
  ran_by       uuid NULL,
  result       jsonb NOT NULL
);
GRANT SELECT ON public.deal_events_backfill_log TO authenticated;
GRANT ALL    ON public.deal_events_backfill_log TO service_role;
ALTER TABLE public.deal_events_backfill_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_events_backfill_log_admin_read"
ON public.deal_events_backfill_log FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- ---------- 5. Função de backfill (idempotente) --------------------------
CREATE OR REPLACE FUNCTION public.backfill_deal_events()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before bigint;
  v_after  bigint;
  v_inserted bigint;
  v_approx bigint;
  v_by_source jsonb;
  v_result jsonb;
BEGIN
  SELECT count(*) INTO v_before FROM public.deal_events;

  -- 5.1 deal_created (a partir de quotes)
  INSERT INTO public.deal_events (
    quote_id, lead_id, event_type, to_phase, to_stage,
    amount, user_id, user_name, source, occurred_at, metadata, dedup_key
  )
  SELECT
    q.id, q.lead_id, 'deal_created',
    public.deal_event_phase_of(q.stage::text), q.stage::text,
    q.total_value, q.created_by,
    COALESCE((SELECT COALESCE(p.full_name, p.email) FROM public.profiles p WHERE p.user_id = q.created_by LIMIT 1), 'Sistema (backfill)'),
    'backfill', q.created_at, jsonb_build_object('title', q.title),
    'backfill:deal_created:' || q.id::text || ':' || extract(epoch FROM q.created_at)::bigint::text
  FROM public.quotes q
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

  -- 5.2 stage_changed / phase_changed (a partir de quote_history action='stage_change')
  INSERT INTO public.deal_events (
    quote_id, lead_id, event_type,
    from_phase, to_phase, from_stage, to_stage,
    user_id, user_name, source, occurred_at, metadata, dedup_key
  )
  SELECT
    qh.quote_id, q.lead_id,
    CASE
      WHEN public.deal_event_phase_of(qh.details->>'from')
         IS DISTINCT FROM public.deal_event_phase_of(qh.details->>'to')
      THEN 'phase_changed'
      ELSE 'stage_changed'
    END,
    public.deal_event_phase_of(qh.details->>'from'),
    public.deal_event_phase_of(qh.details->>'to'),
    qh.details->>'from',
    qh.details->>'to',
    qh.user_id, COALESCE(qh.user_name, 'Sistema (backfill)'),
    'backfill', qh.created_at,
    jsonb_build_object('source_history_id', qh.id),
    'backfill:stage_changed:' || qh.quote_id::text
      || ':' || extract(epoch FROM qh.created_at)::bigint::text
      || ':' || COALESCE(qh.details->>'from','-') || '->' || COALESCE(qh.details->>'to','-')
  FROM public.quote_history qh
  JOIN public.quotes q ON q.id = qh.quote_id
  WHERE qh.action = 'stage_change'
    AND qh.details ? 'to'
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

  -- 5.3 quote_sent (cotações que estão em estágios pós-envio mas sem evento de envio detectado)
  -- Aproximado: usa created_at quando não há histórico. Marcado.
  INSERT INTO public.deal_events (
    quote_id, lead_id, event_type, to_stage,
    source, occurred_at, metadata, dedup_key
  )
  SELECT
    q.id, q.lead_id, 'quote_sent', 'sent',
    'backfill', q.updated_at,
    jsonb_build_object('timestamp_approximate', true,
                       'reason', 'inferido pelo stage atual; sem registro em quote_history'),
    'backfill:quote_sent:' || q.id::text || ':inferred'
  FROM public.quotes q
  WHERE q.stage::text IN ('sent','negotiation','confirmed','issued','completed','post_sale')
    AND NOT EXISTS (
      SELECT 1 FROM public.quote_history qh
      WHERE qh.quote_id = q.id
        AND qh.action = 'stage_change'
        AND qh.details->>'to' = 'sent'
    )
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

  -- 5.4 quote_accepted (a partir de quote_acceptances)
  INSERT INTO public.deal_events (
    quote_id, lead_id, event_type, to_phase, to_stage,
    amount, source, occurred_at, metadata, dedup_key
  )
  SELECT
    qa.quote_id, q.lead_id, 'quote_accepted', 'selling', 'confirmed',
    q.total_value, 'backfill', qa.accepted_at,
    jsonb_build_object('acceptance_id', qa.id, 'accepter_name', qa.accepter_name),
    'backfill:quote_accepted:' || qa.quote_id::text
      || ':' || extract(epoch FROM qa.accepted_at)::bigint::text
      || ':' || qa.id::text
  FROM public.quote_acceptances qa
  JOIN public.quotes q ON q.id = qa.quote_id
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

  -- 5.5 quote_lost (conclusion_type='lost' sem evento equivalente)
  INSERT INTO public.deal_events (
    quote_id, lead_id, event_type, reason_code, reason_text,
    source, occurred_at, metadata, dedup_key
  )
  SELECT
    q.id, q.lead_id, 'quote_lost', NULL, NULL,
    'backfill', q.updated_at,
    jsonb_build_object('timestamp_approximate', true,
                       'reason', 'inferido por conclusion_type=lost; sem rastro de quando ocorreu',
                       'conclusion_type', q.conclusion_type),
    'backfill:quote_lost:' || q.id::text || ':' || extract(epoch FROM q.updated_at)::bigint::text
  FROM public.quotes q
  WHERE q.conclusion_type = 'lost'
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

  -- 5.6 quote_archived
  INSERT INTO public.deal_events (
    quote_id, lead_id, event_type,
    user_id, user_name, source, occurred_at, metadata, dedup_key
  )
  SELECT
    q.id, q.lead_id, 'quote_archived',
    q.archived_by,
    COALESCE((SELECT COALESCE(p.full_name, p.email) FROM public.profiles p WHERE p.user_id = q.archived_by LIMIT 1), 'Sistema (backfill)'),
    'backfill', q.archived_at,
    jsonb_build_object('archived_by', q.archived_by),
    'backfill:quote_archived:' || q.id::text || ':' || extract(epoch FROM q.archived_at)::bigint::text
  FROM public.quotes q
  WHERE q.archived_at IS NOT NULL
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

  -- 5.7 sale_created
  INSERT INTO public.deal_events (
    sale_id, quote_id, event_type, to_phase, to_stage,
    amount, user_id, user_name, source, occurred_at, metadata, dedup_key
  )
  SELECT
    s.id, s.quote_id, 'sale_created',
    public.deal_event_phase_of(s.stage), s.stage,
    s.total_value, s.created_by,
    COALESCE((SELECT COALESCE(p.full_name, p.email) FROM public.profiles p WHERE p.user_id = s.created_by LIMIT 1), 'Sistema (backfill)'),
    'backfill', s.created_at,
    jsonb_build_object('ticket_number', s.ticket_number),
    'backfill:sale_created:' || s.id::text || ':' || extract(epoch FROM s.created_at)::bigint::text
  FROM public.sales s
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

  -- 5.8 client_promoted (a partir de contact_events level_promoted -> cliente)
  INSERT INTO public.deal_events (
    contact_id, lead_id, event_type,
    user_id, user_name, source, occurred_at, metadata, dedup_key
  )
  SELECT
    c.id, ce.lead_id, 'client_promoted',
    ce.user_id, COALESCE(ce.user_name, 'Sistema (backfill)'),
    'backfill', ce.created_at,
    jsonb_build_object('source_event_id', ce.id,
                       'from', ce.metadata->>'from', 'to', ce.metadata->>'to'),
    'backfill:client_promoted:' || c.id::text || ':' || extract(epoch FROM ce.created_at)::bigint::text
  FROM public.contact_events ce
  JOIN public.contacts c ON c.lead_id = ce.lead_id
  WHERE ce.event_type = 'level_promoted'
    AND (ce.metadata->>'to') = 'cliente'
  ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING;

  -- Estatísticas
  SELECT count(*) INTO v_after FROM public.deal_events;
  v_inserted := v_after - v_before;

  SELECT count(*) INTO v_approx
  FROM public.deal_events
  WHERE source = 'backfill' AND (metadata->>'timestamp_approximate')::boolean IS TRUE;

  SELECT jsonb_object_agg(source, n) INTO v_by_source FROM (
    SELECT source, count(*)::bigint AS n FROM public.deal_events GROUP BY source
  ) s;

  v_result := jsonb_build_object(
    'inserted_now', v_inserted,
    'total_rows',   v_after,
    'approximate_timestamps', v_approx,
    'by_source', COALESCE(v_by_source, '{}'::jsonb)
  );

  INSERT INTO public.deal_events_backfill_log (ran_by, result)
  VALUES (auth.uid(), v_result);

  RETURN v_result;
END;
$$;

-- ---------- 6. Auditoria de cobertura ------------------------------------
CREATE OR REPLACE FUNCTION public.audit_deal_events_coverage()
RETURNS TABLE(metric text, expected bigint, in_log bigint, gap bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH m AS (
    SELECT 'quotes existentes (deal_created)'::text AS metric,
           (SELECT count(*) FROM public.quotes) AS expected,
           (SELECT count(*) FROM public.deal_events WHERE event_type='deal_created') AS in_log
    UNION ALL
    SELECT 'quote_history stage_change (stage_changed+phase_changed)',
           (SELECT count(*) FROM public.quote_history WHERE action='stage_change' AND details ? 'to'),
           (SELECT count(*) FROM public.deal_events WHERE event_type IN ('stage_changed','phase_changed'))
    UNION ALL
    SELECT 'quote_acceptances (quote_accepted)',
           (SELECT count(*) FROM public.quote_acceptances),
           (SELECT count(*) FROM public.deal_events WHERE event_type='quote_accepted')
    UNION ALL
    SELECT 'quotes conclusion_type=lost (quote_lost)',
           (SELECT count(*) FROM public.quotes WHERE conclusion_type='lost'),
           (SELECT count(*) FROM public.deal_events WHERE event_type='quote_lost')
    UNION ALL
    SELECT 'quotes archived (quote_archived)',
           (SELECT count(*) FROM public.quotes WHERE archived_at IS NOT NULL),
           (SELECT count(*) FROM public.deal_events WHERE event_type='quote_archived')
    UNION ALL
    SELECT 'sales (sale_created)',
           (SELECT count(*) FROM public.sales),
           (SELECT count(*) FROM public.deal_events WHERE event_type='sale_created')
    UNION ALL
    SELECT 'contact_events lead->cliente (client_promoted)',
           (SELECT count(*) FROM public.contact_events
              WHERE event_type='level_promoted' AND (metadata->>'to')='cliente'),
           (SELECT count(*) FROM public.deal_events WHERE event_type='client_promoted')
  )
  SELECT metric, expected, in_log, (expected - in_log) AS gap FROM m;
$$;

-- =========================================================================
-- 7. EXECUTAR O BACKFILL AGORA (antes de criar qualquer trigger de log)
-- =========================================================================
DO $$
DECLARE r jsonb;
BEGIN
  SELECT public.backfill_deal_events() INTO r;
  RAISE NOTICE 'deal_events backfill result: %', r;
END $$;

-- =========================================================================
-- 8. TRIGGERS DE LOG (criados SÓ AGORA, depois do backfill)
--    - Apenas observam: nada é alterado em quotes/sales/quote_items/contacts.
--    - Cada função tem EXCEPTION WHEN OTHERS: falha do log NÃO bloqueia
--      a operação original.
-- =========================================================================

-- 8.1 quotes INSERT -> deal_created
CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_quote_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO public.deal_events (
      quote_id, lead_id, event_type, to_phase, to_stage,
      amount, user_id, user_name, source, occurred_at, metadata
    ) VALUES (
      NEW.id, NEW.lead_id, 'deal_created',
      public.deal_event_phase_of(NEW.stage::text), NEW.stage::text,
      NEW.total_value, NEW.created_by,
      public.current_user_display_name(),
      'trigger', NEW.created_at,
      jsonb_build_object('title', NEW.title)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events quote_insert log failed: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_deal_events_quote_insert
AFTER INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_deal_events_quote_insert();

-- 8.2 quotes UPDATE -> stage/phase changed, sent, accepted, lost, archived
CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_quote_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user text := public.current_user_display_name();
  v_from_phase text;
  v_to_phase text;
BEGIN
  BEGIN
    -- stage / phase changed
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
      v_from_phase := public.deal_event_phase_of(OLD.stage::text);
      v_to_phase   := public.deal_event_phase_of(NEW.stage::text);

      INSERT INTO public.deal_events (
        quote_id, lead_id, event_type,
        from_phase, to_phase, from_stage, to_stage,
        user_id, user_name, source, occurred_at
      ) VALUES (
        NEW.id, NEW.lead_id,
        CASE WHEN v_from_phase IS DISTINCT FROM v_to_phase
             THEN 'phase_changed' ELSE 'stage_changed' END,
        v_from_phase, v_to_phase, OLD.stage::text, NEW.stage::text,
        v_uid, v_user, 'trigger', now()
      );

      IF NEW.stage::text = 'sent' THEN
        INSERT INTO public.deal_events (
          quote_id, lead_id, event_type, to_stage,
          user_id, user_name, source, occurred_at
        ) VALUES (
          NEW.id, NEW.lead_id, 'quote_sent', 'sent',
          v_uid, v_user, 'trigger', now()
        );
      END IF;
    END IF;

    -- accepted / lost (via conclusion_type)
    IF NEW.conclusion_type IS DISTINCT FROM OLD.conclusion_type THEN
      IF NEW.conclusion_type = 'won' THEN
        INSERT INTO public.deal_events (
          quote_id, lead_id, event_type, to_phase, to_stage,
          amount, user_id, user_name, source, occurred_at
        ) VALUES (
          NEW.id, NEW.lead_id, 'quote_accepted', 'selling', NEW.stage::text,
          NEW.total_value, v_uid, v_user, 'trigger', now()
        );
      ELSIF NEW.conclusion_type = 'lost' THEN
        INSERT INTO public.deal_events (
          quote_id, lead_id, event_type,
          user_id, user_name, source, occurred_at
        ) VALUES (
          NEW.id, NEW.lead_id, 'quote_lost',
          v_uid, v_user, 'trigger', now()
        );
      END IF;
    END IF;

    -- archived / unarchived
    IF (OLD.archived_at IS NULL) AND (NEW.archived_at IS NOT NULL) THEN
      INSERT INTO public.deal_events (
        quote_id, lead_id, event_type, user_id, user_name, source, occurred_at, metadata
      ) VALUES (
        NEW.id, NEW.lead_id, 'quote_archived', v_uid, v_user, 'trigger', NEW.archived_at,
        jsonb_build_object('archived_by', NEW.archived_by)
      );
    ELSIF (OLD.archived_at IS NOT NULL) AND (NEW.archived_at IS NULL) THEN
      INSERT INTO public.deal_events (
        quote_id, lead_id, event_type, user_id, user_name, source, occurred_at
      ) VALUES (
        NEW.id, NEW.lead_id, 'quote_unarchived', v_uid, v_user, 'trigger', now()
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events quote_update log failed: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_deal_events_quote_update
AFTER UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_deal_events_quote_update();

-- 8.3 sales INSERT
CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_sale_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO public.deal_events (
      sale_id, quote_id, event_type, to_phase, to_stage,
      amount, user_id, user_name, source, occurred_at, metadata
    ) VALUES (
      NEW.id, NEW.quote_id, 'sale_created',
      public.deal_event_phase_of(NEW.stage), NEW.stage,
      NEW.total_value, NEW.created_by,
      public.current_user_display_name(),
      'trigger', NEW.created_at,
      jsonb_build_object('ticket_number', NEW.ticket_number)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events sale_insert log failed: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_deal_events_sale_insert
AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_deal_events_sale_insert();

-- 8.4 sales UPDATE
CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_sale_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_from_phase text;
  v_to_phase text;
BEGIN
  BEGIN
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
      v_from_phase := public.deal_event_phase_of(OLD.stage);
      v_to_phase   := public.deal_event_phase_of(NEW.stage);
      INSERT INTO public.deal_events (
        sale_id, quote_id, event_type,
        from_phase, to_phase, from_stage, to_stage,
        user_id, user_name, source, occurred_at
      ) VALUES (
        NEW.id, NEW.quote_id, 'sale_stage_changed',
        v_from_phase, v_to_phase, OLD.stage, NEW.stage,
        auth.uid(), public.current_user_display_name(), 'trigger', now()
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events sale_update log failed: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_deal_events_sale_update
AFTER UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_deal_events_sale_update();

-- 8.5 quote_items add/update/remove
CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_item_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote_id uuid;
  v_lead_id  uuid;
  v_event    text;
  v_item_id  uuid;
  v_meta     jsonb := '{}'::jsonb;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      v_event := 'item_added'; v_item_id := NEW.id; v_quote_id := NEW.quote_id;
      v_meta := jsonb_build_object('item_type', NEW.item_type, 'title', NEW.title, 'unit_price', NEW.unit_price, 'quantity', NEW.quantity);
    ELSIF TG_OP = 'UPDATE' THEN
      v_event := 'item_updated'; v_item_id := NEW.id; v_quote_id := NEW.quote_id;
      v_meta := jsonb_build_object(
        'changed_unit_price', NEW.unit_price IS DISTINCT FROM OLD.unit_price,
        'changed_quantity',   NEW.quantity   IS DISTINCT FROM OLD.quantity,
        'changed_title',      NEW.title      IS DISTINCT FROM OLD.title
      );
      -- evita ruído: pula updates triviais (sort_order, attachment_urls)
      IF NOT (
        NEW.unit_price IS DISTINCT FROM OLD.unit_price
        OR NEW.quantity IS DISTINCT FROM OLD.quantity
        OR NEW.title IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.item_type IS DISTINCT FROM OLD.item_type
        OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
      ) THEN
        RETURN NEW;
      END IF;
    ELSE -- DELETE
      v_event := 'item_removed'; v_item_id := OLD.id; v_quote_id := OLD.quote_id;
      v_meta := jsonb_build_object('item_type', OLD.item_type, 'title', OLD.title);
    END IF;

    SELECT lead_id INTO v_lead_id FROM public.quotes WHERE id = v_quote_id;

    INSERT INTO public.deal_events (
      quote_id, lead_id, item_id, event_type,
      user_id, user_name, source, occurred_at, metadata
    ) VALUES (
      v_quote_id, v_lead_id, v_item_id, v_event,
      auth.uid(), public.current_user_display_name(), 'trigger', now(), v_meta
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events item_change log failed: %', SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_deal_events_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_deal_events_item_change();

-- 8.6 contacts UPDATE -> client_promoted (somente transição -> cliente)
CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_contact_promoted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    IF OLD.level IS DISTINCT FROM NEW.level AND NEW.level = 'cliente' THEN
      INSERT INTO public.deal_events (
        contact_id, lead_id, event_type,
        user_id, user_name, source, occurred_at, metadata
      ) VALUES (
        NEW.id, NEW.lead_id, 'client_promoted',
        auth.uid(), public.current_user_display_name(), 'trigger', now(),
        jsonb_build_object('from', OLD.level, 'to', NEW.level, 'client_id', NEW.client_id)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events contact_promoted log failed: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_deal_events_contact_promoted
AFTER UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_deal_events_contact_promoted();
