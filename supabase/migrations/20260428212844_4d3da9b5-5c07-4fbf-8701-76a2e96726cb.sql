
-- =====================================================
-- TABELA: contact_events (Timeline do contato/lead)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  link text,
  user_id uuid,
  user_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_events_lead_id ON public.contact_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_contact_events_created_at ON public.contact_events(created_at DESC);

ALTER TABLE public.contact_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contact_events"
  ON public.contact_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contact_events"
  ON public.contact_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admins and managers can delete contact_events"
  ON public.contact_events FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_events;

-- =====================================================
-- HELPER: nome do usuário atual
-- =====================================================
CREATE OR REPLACE FUNCTION public.current_user_display_name()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(p.full_name, p.email, 'Sistema')
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

-- =====================================================
-- TRIGGER: lead criado
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_lead_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_source text;
BEGIN
  v_source := CASE COALESCE(NEW.source, 'manual')
    WHEN 'whatsapp' THEN 'WhatsApp'
    WHEN 'instagram' THEN 'Instagram'
    WHEN 'site' THEN 'Site'
    WHEN 'indicacao' THEN 'Indicação'
    WHEN 'manual' THEN 'Manual'
    ELSE COALESCE(NEW.source, 'Manual')
  END;

  INSERT INTO public.contact_events (lead_id, event_type, title, description, user_id, user_name, metadata)
  VALUES (
    NEW.id,
    'contact_created',
    'Contato criado',
    'Origem: ' || v_source,
    auth.uid(),
    public.current_user_display_name(),
    jsonb_build_object('source', NEW.source)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_lead_created ON public.leads;
CREATE TRIGGER trg_log_lead_created
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_created();

-- =====================================================
-- TRIGGER: lead atualizado (nome, responsável, campos)
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_lead_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user text := public.current_user_display_name();
  v_uid uuid := auth.uid();
  v_old_assignee text;
  v_new_assignee text;
  v_changed text[] := ARRAY[]::text[];
  v_field_labels jsonb := jsonb_build_object(
    'destination','Destino',
    'travel_date_start','Data de início',
    'travel_date_end','Data de término',
    'budget_estimate','Orçamento',
    'travelers_count','Número de viajantes',
    'preferences','Preferências',
    'trip_profile','Perfil de viagem',
    'lead_temperature','Temperatura',
    'phone','Telefone',
    'email','E-mail'
  );
  k text;
BEGIN
  -- Nome alterado: mostrar antes/depois quando passar de "número/placeholder" para nome real
  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    INSERT INTO public.contact_events (lead_id, event_type, title, description, user_id, user_name, metadata)
    VALUES (
      NEW.id, 'name_updated', 'Nome atualizado',
      'De "' || COALESCE(OLD.full_name,'—') || '" para "' || COALESCE(NEW.full_name,'—') || '"',
      v_uid, v_user,
      jsonb_build_object('old', OLD.full_name, 'new', NEW.full_name)
    );
  END IF;

  -- Responsável atribuído/alterado
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id THEN
    SELECT COALESCE(full_name, email) INTO v_old_assignee FROM public.profiles WHERE user_id = OLD.assigned_user_id LIMIT 1;
    SELECT COALESCE(full_name, email) INTO v_new_assignee FROM public.profiles WHERE user_id = NEW.assigned_user_id LIMIT 1;
    INSERT INTO public.contact_events (lead_id, event_type, title, description, user_id, user_name, metadata)
    VALUES (
      NEW.id, 'assignee_changed',
      CASE WHEN OLD.assigned_user_id IS NULL THEN 'Responsável atribuído' ELSE 'Responsável alterado' END,
      CASE
        WHEN OLD.assigned_user_id IS NULL THEN 'Atribuído a ' || COALESCE(v_new_assignee,'—')
        WHEN NEW.assigned_user_id IS NULL THEN 'Removido ' || COALESCE(v_old_assignee,'—')
        ELSE 'De ' || COALESCE(v_old_assignee,'—') || ' para ' || COALESCE(v_new_assignee,'—')
      END,
      v_uid, v_user,
      jsonb_build_object('old', v_old_assignee, 'new', v_new_assignee)
    );
  END IF;

  -- Status (etapa do kanban) alterado
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.contact_events (lead_id, event_type, title, description, user_id, user_name, metadata)
    VALUES (
      NEW.id, 'kanban_moved', 'Card movido no Kanban',
      'De "' || COALESCE(OLD.status,'—') || '" para "' || COALESCE(NEW.status,'—') || '"',
      v_uid, v_user,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;

  -- Campos editados (genérico)
  FOR k IN SELECT jsonb_object_keys(v_field_labels) LOOP
    IF (to_jsonb(NEW) ->> k) IS DISTINCT FROM (to_jsonb(OLD) ->> k) THEN
      v_changed := v_changed || (v_field_labels ->> k);
    END IF;
  END LOOP;

  IF array_length(v_changed, 1) > 0 THEN
    INSERT INTO public.contact_events (lead_id, event_type, title, description, user_id, user_name, metadata)
    VALUES (
      NEW.id, 'fields_edited', 'Campos editados',
      'Campos alterados: ' || array_to_string(v_changed, ', '),
      v_uid, v_user,
      jsonb_build_object('fields', v_changed)
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_lead_updated ON public.leads;
CREATE TRIGGER trg_log_lead_updated
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_updated();

-- =====================================================
-- TRIGGER: contact promovido (prospect→lead, lead→cliente)
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_contact_level_promoted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user text := public.current_user_display_name();
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.level IS DISTINCT FROM NEW.level AND NEW.lead_id IS NOT NULL THEN
    INSERT INTO public.contact_events (lead_id, event_type, title, description, user_id, user_name, metadata)
    VALUES (
      NEW.lead_id, 'level_promoted',
      'Nível promovido',
      'De ' || INITCAP(OLD.level::text) || ' para ' || INITCAP(NEW.level::text),
      auth.uid(), v_user,
      jsonb_build_object('from', OLD.level, 'to', NEW.level)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_contact_level_promoted ON public.contacts;
CREATE TRIGGER trg_log_contact_level_promoted
  AFTER UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.log_contact_level_promoted();

-- =====================================================
-- TRIGGER: cotação criada / enviada
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_quote_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user text := public.current_user_display_name();
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contact_events (lead_id, event_type, title, description, link, user_id, user_name, metadata)
    VALUES (
      NEW.lead_id, 'quote_created', 'Cotação criada',
      COALESCE(NEW.title, 'Nova cotação vinculada'),
      '/quotes?id=' || NEW.id::text,
      v_uid, v_user,
      jsonb_build_object('quote_id', NEW.id, 'title', NEW.title)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.stage IS DISTINCT FROM OLD.stage AND NEW.stage IN ('proposal-sent','proposal_sent','sent') THEN
      INSERT INTO public.contact_events (lead_id, event_type, title, description, link, user_id, user_name, metadata)
      VALUES (
        NEW.lead_id, 'quote_sent', 'Cotação enviada ao cliente',
        COALESCE(NEW.title, 'Cotação'),
        '/quotes?id=' || NEW.id::text,
        v_uid, v_user,
        jsonb_build_object('quote_id', NEW.id, 'stage', NEW.stage)
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_quote_event ON public.quotes;
CREATE TRIGGER trg_log_quote_event
  AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.log_quote_event();
