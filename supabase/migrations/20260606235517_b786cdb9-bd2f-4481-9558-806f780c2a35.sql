
-- ===========================================================================
-- ETAPA 3 (Opção B): camada `deals` sincronizada em paralelo
-- ===========================================================================

-- 0. SNAPSHOTS pré-migração -------------------------------------------------
CREATE TABLE IF NOT EXISTS public._pre_etapa3_snapshot_quotes      AS TABLE public.quotes      WITH NO DATA;
CREATE TABLE IF NOT EXISTS public._pre_etapa3_snapshot_sales       AS TABLE public.sales       WITH NO DATA;
CREATE TABLE IF NOT EXISTS public._pre_etapa3_snapshot_quote_items AS TABLE public.quote_items WITH NO DATA;
CREATE TABLE IF NOT EXISTS public._pre_etapa3_snapshot_deal_events_dealid_nulls (
  id uuid, quote_id uuid, sale_id uuid, event_type text, recorded_at timestamptz
);

INSERT INTO public._pre_etapa3_snapshot_quotes      SELECT * FROM public.quotes;
INSERT INTO public._pre_etapa3_snapshot_sales       SELECT * FROM public.sales;
INSERT INTO public._pre_etapa3_snapshot_quote_items SELECT * FROM public.quote_items;
INSERT INTO public._pre_etapa3_snapshot_deal_events_dealid_nulls
  SELECT id, quote_id, sale_id, event_type, recorded_at FROM public.deal_events WHERE deal_id IS NULL;

REVOKE ALL ON public._pre_etapa3_snapshot_quotes,
              public._pre_etapa3_snapshot_sales,
              public._pre_etapa3_snapshot_quote_items,
              public._pre_etapa3_snapshot_deal_events_dealid_nulls FROM PUBLIC;
GRANT ALL ON public._pre_etapa3_snapshot_quotes,
             public._pre_etapa3_snapshot_sales,
             public._pre_etapa3_snapshot_quote_items,
             public._pre_etapa3_snapshot_deal_events_dealid_nulls TO service_role;

-- 1. ENUM deal_phase --------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_phase') THEN
    CREATE TYPE public.deal_phase AS ENUM ('quoting','selling','fulfilling');
  END IF;
END $$;

-- 2. TABELA deals -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY,
  source_quote_id uuid UNIQUE,
  source_sale_id  uuid UNIQUE,
  client_id  uuid,
  lead_id    uuid,
  assigned_to uuid,
  created_by  uuid,
  company    public.company_brand NOT NULL DEFAULT 'altivus',
  phase      public.deal_phase NOT NULL DEFAULT 'quoting',
  stage      text NOT NULL,
  title       text,
  destination text,
  departure_city text,
  departure_airport text,
  travel_date_start date,
  travel_date_end   date,
  total_value     numeric,
  discount_amount numeric,
  discount_percent numeric,
  notes          text,
  internal_notes text,
  client_notes   text,
  terms_conditions text,
  payment_terms text,
  other_info    text,
  details       text,
  cover_image_url text,
  destination_images text[],
  price_breakdown jsonb,
  quote_validity date,
  validity_warning_sent_at timestamptz,
  conclusion_type text,
  close_probability text,
  lead_source text,
  internal_due_date date,
  archived_at timestamptz,
  archived_by uuid,
  current_acceptance_id uuid,
  ticket_number text,
  ticket_issued_at timestamptz,
  lost_reason_code text,
  lost_reason_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deals_has_source CHECK (source_quote_id IS NOT NULL OR source_sale_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS deals_assigned_to_idx ON public.deals(assigned_to);
CREATE INDEX IF NOT EXISTS deals_created_by_idx  ON public.deals(created_by);
CREATE INDEX IF NOT EXISTS deals_lead_id_idx     ON public.deals(lead_id);
CREATE INDEX IF NOT EXISTS deals_phase_idx       ON public.deals(phase);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals admins/managers full" ON public.deals;
CREATE POLICY "deals admins/managers full" ON public.deals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

DROP POLICY IF EXISTS "deals own read" ON public.deals;
CREATE POLICY "deals own read" ON public.deals
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS "deals own write" ON public.deals;
CREATE POLICY "deals own write" ON public.deals
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (assigned_to = auth.uid() OR created_by = auth.uid());

-- 3. TABELA deal_templates --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_templates (
  id uuid PRIMARY KEY,
  source_quote_id uuid UNIQUE,
  template_name text,
  title text,
  company public.company_brand NOT NULL DEFAULT 'altivus',
  created_by uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_templates TO authenticated;
GRANT ALL ON public.deal_templates TO service_role;
ALTER TABLE public.deal_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deal_templates authenticated" ON public.deal_templates;
CREATE POLICY "deal_templates authenticated" ON public.deal_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. quote_items.deal_id ----------------------------------------------------
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS deal_id uuid;
CREATE INDEX IF NOT EXISTS quote_items_deal_id_idx ON public.quote_items(deal_id);

-- 5. BACKFILL ---------------------------------------------------------------
INSERT INTO public.deals (
  id, source_quote_id, client_id, lead_id, assigned_to, created_by, company,
  phase, stage, title, destination, departure_city, departure_airport,
  travel_date_start, travel_date_end, total_value, discount_amount, discount_percent,
  notes, internal_notes, client_notes, terms_conditions, payment_terms, other_info, details,
  cover_image_url, destination_images, price_breakdown,
  quote_validity, validity_warning_sent_at,
  conclusion_type, close_probability, lead_source, internal_due_date,
  archived_at, archived_by, current_acceptance_id, created_at, updated_at
)
SELECT
  q.id, q.id, q.client_id, q.lead_id, q.assigned_to, q.created_by, q.company,
  COALESCE(public.deal_event_phase_of(q.stage::text), 'quoting')::public.deal_phase,
  q.stage::text,
  q.title, q.destination, q.departure_city, q.departure_airport,
  q.travel_date_start, q.travel_date_end, q.total_value, q.discount_amount, q.discount_percent,
  q.notes, q.internal_notes, q.client_notes, q.terms_conditions, q.payment_terms, q.other_info, q.details,
  q.cover_image_url, q.destination_images, q.price_breakdown,
  q.quote_validity, q.validity_warning_sent_at,
  q.conclusion_type, q.close_probability, q.lead_source, q.internal_due_date,
  q.archived_at, q.archived_by,
  (SELECT qa.id FROM public.quote_acceptances qa WHERE qa.quote_id = q.id ORDER BY qa.accepted_at DESC LIMIT 1),
  q.created_at, q.updated_at
FROM public.quotes q
WHERE q.is_template = false
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deal_templates (id, source_quote_id, template_name, title, company, created_by, payload, created_at, updated_at)
SELECT q.id, q.id, q.template_name, q.title, q.company, q.created_by,
       to_jsonb(q.*) - 'id' - 'created_at' - 'updated_at',
       q.created_at, q.updated_at
FROM public.quotes q
WHERE q.is_template = true
ON CONFLICT (id) DO NOTHING;

UPDATE public.deals d
SET phase = COALESCE(public.deal_event_phase_of(s.stage), 'selling')::public.deal_phase,
    stage = s.stage,
    ticket_number = COALESCE(s.ticket_number, d.ticket_number),
    ticket_issued_at = COALESCE(s.ticket_issued_at, d.ticket_issued_at),
    source_sale_id = s.id,
    updated_at = now()
FROM public.sales s
WHERE s.quote_id = d.id;

INSERT INTO public.deals (id, source_sale_id, client_id, assigned_to, created_by, company,
  phase, stage, destination, total_value, travel_date_start, travel_date_end,
  notes, ticket_number, ticket_issued_at, created_at, updated_at)
SELECT s.id, s.id, s.client_id, s.assigned_to, s.created_by, 'altivus'::public.company_brand,
       COALESCE(public.deal_event_phase_of(s.stage), 'selling')::public.deal_phase,
       s.stage, s.destination, s.total_value, s.travel_date_start, s.travel_date_end,
       s.notes, s.ticket_number, s.ticket_issued_at, s.created_at, s.updated_at
FROM public.sales s
WHERE s.quote_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.quote_items SET deal_id = quote_id WHERE deal_id IS NULL AND quote_id IS NOT NULL;

UPDATE public.deal_events de
SET deal_id = d.id
FROM public.deals d
WHERE de.deal_id IS NULL
  AND (de.quote_id = d.source_quote_id OR de.sale_id = d.source_sale_id);

-- 6. SYNC FUNCTIONS (BEFORE triggers) ---------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_sync_quote_to_deal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM public.deals          WHERE id = OLD.id;
      DELETE FROM public.deal_templates WHERE id = OLD.id;
      RETURN OLD;
    END IF;

    IF NEW.is_template = true THEN
      DELETE FROM public.deals WHERE id = NEW.id;
      INSERT INTO public.deal_templates (id, source_quote_id, template_name, title, company, created_by, payload, created_at, updated_at)
      VALUES (NEW.id, NEW.id, NEW.template_name, NEW.title, NEW.company, NEW.created_by,
              to_jsonb(NEW.*) - 'id' - 'created_at' - 'updated_at', NEW.created_at, NEW.updated_at)
      ON CONFLICT (id) DO UPDATE SET
        template_name = EXCLUDED.template_name,
        title = EXCLUDED.title,
        payload = EXCLUDED.payload,
        updated_at = now();
      RETURN NEW;
    END IF;

    DELETE FROM public.deal_templates WHERE id = NEW.id;

    INSERT INTO public.deals (
      id, source_quote_id, client_id, lead_id, assigned_to, created_by, company,
      phase, stage, title, destination, departure_city, departure_airport,
      travel_date_start, travel_date_end, total_value, discount_amount, discount_percent,
      notes, internal_notes, client_notes, terms_conditions, payment_terms, other_info, details,
      cover_image_url, destination_images, price_breakdown,
      quote_validity, validity_warning_sent_at,
      conclusion_type, close_probability, lead_source, internal_due_date,
      archived_at, archived_by, current_acceptance_id, created_at, updated_at
    ) VALUES (
      NEW.id, NEW.id, NEW.client_id, NEW.lead_id, NEW.assigned_to, NEW.created_by, NEW.company,
      COALESCE(public.deal_event_phase_of(NEW.stage::text), 'quoting')::public.deal_phase,
      NEW.stage::text,
      NEW.title, NEW.destination, NEW.departure_city, NEW.departure_airport,
      NEW.travel_date_start, NEW.travel_date_end, NEW.total_value, NEW.discount_amount, NEW.discount_percent,
      NEW.notes, NEW.internal_notes, NEW.client_notes, NEW.terms_conditions, NEW.payment_terms, NEW.other_info, NEW.details,
      NEW.cover_image_url, NEW.destination_images, NEW.price_breakdown,
      NEW.quote_validity, NEW.validity_warning_sent_at,
      NEW.conclusion_type, NEW.close_probability, NEW.lead_source, NEW.internal_due_date,
      NEW.archived_at, NEW.archived_by,
      (SELECT qa.id FROM public.quote_acceptances qa WHERE qa.quote_id = NEW.id ORDER BY qa.accepted_at DESC LIMIT 1),
      NEW.created_at, NEW.updated_at
    )
    ON CONFLICT (id) DO UPDATE SET
      source_quote_id = EXCLUDED.source_quote_id,
      client_id = EXCLUDED.client_id,
      lead_id = EXCLUDED.lead_id,
      assigned_to = EXCLUDED.assigned_to,
      company = EXCLUDED.company,
      phase = EXCLUDED.phase,
      stage = EXCLUDED.stage,
      title = EXCLUDED.title,
      destination = EXCLUDED.destination,
      departure_city = EXCLUDED.departure_city,
      departure_airport = EXCLUDED.departure_airport,
      travel_date_start = EXCLUDED.travel_date_start,
      travel_date_end = EXCLUDED.travel_date_end,
      total_value = EXCLUDED.total_value,
      discount_amount = EXCLUDED.discount_amount,
      discount_percent = EXCLUDED.discount_percent,
      notes = EXCLUDED.notes,
      internal_notes = EXCLUDED.internal_notes,
      client_notes = EXCLUDED.client_notes,
      terms_conditions = EXCLUDED.terms_conditions,
      payment_terms = EXCLUDED.payment_terms,
      other_info = EXCLUDED.other_info,
      details = EXCLUDED.details,
      cover_image_url = EXCLUDED.cover_image_url,
      destination_images = EXCLUDED.destination_images,
      price_breakdown = EXCLUDED.price_breakdown,
      quote_validity = EXCLUDED.quote_validity,
      validity_warning_sent_at = EXCLUDED.validity_warning_sent_at,
      conclusion_type = EXCLUDED.conclusion_type,
      close_probability = EXCLUDED.close_probability,
      lead_source = EXCLUDED.lead_source,
      internal_due_date = EXCLUDED.internal_due_date,
      archived_at = EXCLUDED.archived_at,
      archived_by = EXCLUDED.archived_by,
      current_acceptance_id = EXCLUDED.current_acceptance_id,
      updated_at = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_quote_to_deal failed for quote %: %', COALESCE(NEW.id, OLD.id), SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END $fn$;

CREATE OR REPLACE FUNCTION public.trg_fn_sync_sale_to_deal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF OLD.quote_id IS NOT NULL THEN
        UPDATE public.deals
        SET source_sale_id = NULL,
            phase = COALESCE(public.deal_event_phase_of((SELECT stage::text FROM public.quotes WHERE id = OLD.quote_id)), 'quoting')::public.deal_phase,
            ticket_number = NULL,
            ticket_issued_at = NULL,
            updated_at = now()
        WHERE id = OLD.quote_id;
      ELSE
        DELETE FROM public.deals WHERE id = OLD.id;
      END IF;
      RETURN OLD;
    END IF;

    IF NEW.quote_id IS NOT NULL THEN
      UPDATE public.deals
      SET phase = COALESCE(public.deal_event_phase_of(NEW.stage), 'selling')::public.deal_phase,
          stage = NEW.stage,
          ticket_number = COALESCE(NEW.ticket_number, ticket_number),
          ticket_issued_at = COALESCE(NEW.ticket_issued_at, ticket_issued_at),
          source_sale_id = NEW.id,
          travel_date_start = COALESCE(travel_date_start, NEW.travel_date_start),
          travel_date_end = COALESCE(travel_date_end, NEW.travel_date_end),
          total_value = COALESCE(total_value, NEW.total_value),
          destination = COALESCE(destination, NEW.destination),
          notes = COALESCE(notes, NEW.notes),
          updated_at = now()
      WHERE id = NEW.quote_id;
      IF NOT FOUND THEN
        INSERT INTO public.deals (id, source_sale_id, client_id, assigned_to, created_by, company,
          phase, stage, destination, total_value, travel_date_start, travel_date_end,
          notes, ticket_number, ticket_issued_at, created_at, updated_at)
        VALUES (NEW.id, NEW.id, NEW.client_id, NEW.assigned_to, NEW.created_by, 'altivus'::public.company_brand,
                COALESCE(public.deal_event_phase_of(NEW.stage), 'selling')::public.deal_phase,
                NEW.stage, NEW.destination, NEW.total_value, NEW.travel_date_start, NEW.travel_date_end,
                NEW.notes, NEW.ticket_number, NEW.ticket_issued_at, NEW.created_at, NEW.updated_at)
        ON CONFLICT (id) DO NOTHING;
      END IF;
    ELSE
      INSERT INTO public.deals (id, source_sale_id, client_id, assigned_to, created_by, company,
        phase, stage, destination, total_value, travel_date_start, travel_date_end,
        notes, ticket_number, ticket_issued_at, created_at, updated_at)
      VALUES (NEW.id, NEW.id, NEW.client_id, NEW.assigned_to, NEW.created_by, 'altivus'::public.company_brand,
              COALESCE(public.deal_event_phase_of(NEW.stage), 'selling')::public.deal_phase,
              NEW.stage, NEW.destination, NEW.total_value, NEW.travel_date_start, NEW.travel_date_end,
              NEW.notes, NEW.ticket_number, NEW.ticket_issued_at, NEW.created_at, NEW.updated_at)
      ON CONFLICT (id) DO UPDATE SET
        stage = EXCLUDED.stage, phase = EXCLUDED.phase,
        ticket_number = EXCLUDED.ticket_number,
        ticket_issued_at = EXCLUDED.ticket_issued_at,
        total_value = EXCLUDED.total_value,
        destination = EXCLUDED.destination,
        notes = EXCLUDED.notes,
        updated_at = now();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_sale_to_deal failed for sale %: %', COALESCE(NEW.id, OLD.id), SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END $fn$;

DROP TRIGGER IF EXISTS trg_sync_quote_to_deal ON public.quotes;
CREATE TRIGGER trg_sync_quote_to_deal
  BEFORE INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_sync_quote_to_deal();

DROP TRIGGER IF EXISTS trg_sync_sale_to_deal ON public.sales;
CREATE TRIGGER trg_sync_sale_to_deal
  BEFORE INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_sync_sale_to_deal();

-- 7. ATUALIZA TRIGGERS DA ETAPA 2 PARA POPULAR deal_id ---------------------
CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_quote_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_deal_id uuid;
BEGIN
  BEGIN
    SELECT id INTO v_deal_id FROM public.deals WHERE source_quote_id = NEW.id LIMIT 1;
    INSERT INTO public.deal_events (
      deal_id, quote_id, lead_id, event_type, to_phase, to_stage,
      amount, user_id, user_name, source, occurred_at, metadata
    ) VALUES (
      v_deal_id, NEW.id, NEW.lead_id, 'deal_created',
      public.deal_event_phase_of(NEW.stage::text), NEW.stage::text,
      NEW.total_value, NEW.created_by, public.current_user_display_name(),
      'trigger', NEW.created_at, jsonb_build_object('title', NEW.title)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events quote_insert log failed: %', SQLERRM;
  END;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_quote_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_user text := public.current_user_display_name();
  v_from_phase text; v_to_phase text;
  v_deal_id uuid;
BEGIN
  BEGIN
    SELECT id INTO v_deal_id FROM public.deals WHERE source_quote_id = NEW.id LIMIT 1;
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
      v_from_phase := public.deal_event_phase_of(OLD.stage::text);
      v_to_phase   := public.deal_event_phase_of(NEW.stage::text);
      INSERT INTO public.deal_events (deal_id, quote_id, lead_id, event_type, from_phase, to_phase, from_stage, to_stage, user_id, user_name, source, occurred_at)
      VALUES (v_deal_id, NEW.id, NEW.lead_id,
              CASE WHEN v_from_phase IS DISTINCT FROM v_to_phase THEN 'phase_changed' ELSE 'stage_changed' END,
              v_from_phase, v_to_phase, OLD.stage::text, NEW.stage::text,
              v_uid, v_user, 'trigger', now());
      IF NEW.stage::text = 'sent' THEN
        INSERT INTO public.deal_events (deal_id, quote_id, lead_id, event_type, to_stage, user_id, user_name, source, occurred_at)
        VALUES (v_deal_id, NEW.id, NEW.lead_id, 'quote_sent', 'sent', v_uid, v_user, 'trigger', now());
      END IF;
    END IF;
    IF NEW.conclusion_type IS DISTINCT FROM OLD.conclusion_type THEN
      IF NEW.conclusion_type = 'won' THEN
        INSERT INTO public.deal_events (deal_id, quote_id, lead_id, event_type, to_phase, to_stage, amount, user_id, user_name, source, occurred_at)
        VALUES (v_deal_id, NEW.id, NEW.lead_id, 'quote_accepted', 'selling', NEW.stage::text, NEW.total_value, v_uid, v_user, 'trigger', now());
      ELSIF NEW.conclusion_type = 'lost' THEN
        INSERT INTO public.deal_events (deal_id, quote_id, lead_id, event_type, user_id, user_name, source, occurred_at)
        VALUES (v_deal_id, NEW.id, NEW.lead_id, 'quote_lost', v_uid, v_user, 'trigger', now());
      END IF;
    END IF;
    IF (OLD.archived_at IS NULL) AND (NEW.archived_at IS NOT NULL) THEN
      INSERT INTO public.deal_events (deal_id, quote_id, lead_id, event_type, user_id, user_name, source, occurred_at, metadata)
      VALUES (v_deal_id, NEW.id, NEW.lead_id, 'quote_archived', v_uid, v_user, 'trigger', NEW.archived_at, jsonb_build_object('archived_by', NEW.archived_by));
    ELSIF (OLD.archived_at IS NOT NULL) AND (NEW.archived_at IS NULL) THEN
      INSERT INTO public.deal_events (deal_id, quote_id, lead_id, event_type, user_id, user_name, source, occurred_at)
      VALUES (v_deal_id, NEW.id, NEW.lead_id, 'quote_unarchived', v_uid, v_user, 'trigger', now());
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events quote_update log failed: %', SQLERRM;
  END;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_sale_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_deal_id uuid;
BEGIN
  BEGIN
    SELECT id INTO v_deal_id FROM public.deals WHERE source_sale_id = NEW.id OR id = COALESCE(NEW.quote_id, NEW.id) LIMIT 1;
    INSERT INTO public.deal_events (deal_id, sale_id, quote_id, event_type, to_phase, to_stage, amount, user_id, user_name, source, occurred_at, metadata)
    VALUES (v_deal_id, NEW.id, NEW.quote_id, 'sale_created',
            public.deal_event_phase_of(NEW.stage), NEW.stage,
            NEW.total_value, NEW.created_by, public.current_user_display_name(),
            'trigger', NEW.created_at, jsonb_build_object('ticket_number', NEW.ticket_number));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events sale_insert log failed: %', SQLERRM;
  END;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_sale_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_from_phase text; v_to_phase text; v_deal_id uuid;
BEGIN
  BEGIN
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
      SELECT id INTO v_deal_id FROM public.deals WHERE source_sale_id = NEW.id OR id = COALESCE(NEW.quote_id, NEW.id) LIMIT 1;
      v_from_phase := public.deal_event_phase_of(OLD.stage);
      v_to_phase   := public.deal_event_phase_of(NEW.stage);
      INSERT INTO public.deal_events (deal_id, sale_id, quote_id, event_type, from_phase, to_phase, from_stage, to_stage, user_id, user_name, source, occurred_at)
      VALUES (v_deal_id, NEW.id, NEW.quote_id, 'sale_stage_changed',
              v_from_phase, v_to_phase, OLD.stage, NEW.stage,
              auth.uid(), public.current_user_display_name(), 'trigger', now());
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events sale_update log failed: %', SQLERRM;
  END;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.trg_fn_deal_events_item_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_quote_id uuid; v_lead_id uuid; v_deal_id uuid;
  v_event text; v_item_id uuid; v_meta jsonb := '{}'::jsonb;
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
      IF NOT (
        NEW.unit_price IS DISTINCT FROM OLD.unit_price
        OR NEW.quantity IS DISTINCT FROM OLD.quantity
        OR NEW.title IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.item_type IS DISTINCT FROM OLD.item_type
        OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
      ) THEN RETURN NEW; END IF;
    ELSE
      v_event := 'item_removed'; v_item_id := OLD.id; v_quote_id := OLD.quote_id;
      v_meta := jsonb_build_object('item_type', OLD.item_type, 'title', OLD.title);
    END IF;
    SELECT lead_id INTO v_lead_id FROM public.quotes WHERE id = v_quote_id;
    SELECT id INTO v_deal_id FROM public.deals WHERE source_quote_id = v_quote_id LIMIT 1;
    INSERT INTO public.deal_events (deal_id, quote_id, lead_id, item_id, event_type, user_id, user_name, source, occurred_at, metadata)
    VALUES (v_deal_id, v_quote_id, v_lead_id, v_item_id, v_event, auth.uid(), public.current_user_display_name(), 'trigger', now(), v_meta);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'deal_events item_change log failed: %', SQLERRM;
  END;
  RETURN COALESCE(NEW, OLD);
END $function$;

-- 8. AUDITORIA --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_deals_sync()
RETURNS TABLE(check_name text, expected bigint, actual bigint, gap bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH c AS (
    SELECT 'deals (não-template) == quotes não-template'::text AS check_name,
           (SELECT count(*) FROM public.quotes WHERE is_template=false) AS expected,
           (SELECT count(*) FROM public.deals WHERE source_quote_id IS NOT NULL) AS actual
    UNION ALL
    SELECT 'deal_templates == quotes templates',
           (SELECT count(*) FROM public.quotes WHERE is_template=true),
           (SELECT count(*) FROM public.deal_templates)
    UNION ALL
    SELECT 'deals com source_sale_id == sales',
           (SELECT count(*) FROM public.sales),
           (SELECT count(*) FROM public.deals WHERE source_sale_id IS NOT NULL)
    UNION ALL
    SELECT 'quote_items.deal_id preenchido',
           (SELECT count(*) FROM public.quote_items WHERE quote_id IS NOT NULL),
           (SELECT count(*) FROM public.quote_items WHERE deal_id IS NOT NULL)
    UNION ALL
    SELECT 'deal_events com quote_id/sale_id e SEM deal_id (deve ser 0)',
           0,
           (SELECT count(*) FROM public.deal_events WHERE deal_id IS NULL AND (quote_id IS NOT NULL OR sale_id IS NOT NULL))
    UNION ALL
    SELECT 'deals.stage divergente de quotes.stage (sem sale)',
           0,
           (SELECT count(*) FROM public.deals d JOIN public.quotes q ON q.id = d.source_quote_id
            WHERE NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.quote_id = q.id) AND d.stage <> q.stage::text)
  )
  SELECT check_name, expected, actual, ABS(expected - actual) AS gap FROM c;
$$;
GRANT EXECUTE ON FUNCTION public.audit_deals_sync() TO authenticated, service_role;
