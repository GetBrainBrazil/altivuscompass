
-- 1. New columns on leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_stagnant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stagnant_since timestamptz,
  ADD COLUMN IF NOT EXISTS archive_pending_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_last_interaction_at ON public.leads(last_interaction_at);
CREATE INDEX IF NOT EXISTS idx_leads_is_stagnant ON public.leads(is_stagnant) WHERE is_stagnant = true;

-- Backfill: use updated_at as initial last_interaction_at
UPDATE public.leads SET last_interaction_at = COALESCE(last_contact_at, updated_at, created_at) WHERE last_interaction_at IS NULL OR last_interaction_at = created_at;

-- 2. New settings columns
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS stagnation_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS auto_archive_days integer NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS auto_archive_enabled boolean NOT NULL DEFAULT true;

-- 3. Helper function: bump last_interaction_at and reset stagnation
CREATE OR REPLACE FUNCTION public.touch_lead_interaction(_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _lead_id IS NULL THEN RETURN; END IF;
  UPDATE public.leads
  SET last_interaction_at = now(),
      is_stagnant = false,
      stagnant_since = NULL,
      archive_pending_at = NULL
  WHERE id = _lead_id;
END;
$$;

-- 4. Trigger on contact_events INSERT
CREATE OR REPLACE FUNCTION public.trg_contact_events_touch_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip auto-generated stagnation events themselves
  IF NEW.event_type IN ('lead_stagnant', 'lead_auto_archived', 'lead_auto_archive_warning') THEN
    RETURN NEW;
  END IF;
  PERFORM public.touch_lead_interaction(NEW.lead_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_events_touch_lead ON public.contact_events;
CREATE TRIGGER contact_events_touch_lead
AFTER INSERT ON public.contact_events
FOR EACH ROW EXECUTE FUNCTION public.trg_contact_events_touch_lead();

-- 5. Trigger on wa_messages INSERT (touches lead linked to conversation)
CREATE OR REPLACE FUNCTION public.trg_wa_messages_touch_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_lead_id uuid;
BEGIN
  SELECT lead_id INTO v_lead_id FROM public.wa_conversations WHERE id = NEW.conversation_id;
  IF v_lead_id IS NOT NULL THEN
    PERFORM public.touch_lead_interaction(v_lead_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wa_messages_touch_lead ON public.wa_messages;
CREATE TRIGGER wa_messages_touch_lead
AFTER INSERT ON public.wa_messages
FOR EACH ROW EXECUTE FUNCTION public.trg_wa_messages_touch_lead();

-- 6. Trigger on quotes INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.trg_quotes_touch_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.touch_lead_interaction(NEW.lead_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_touch_lead ON public.quotes;
CREATE TRIGGER quotes_touch_lead
AFTER INSERT OR UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.trg_quotes_touch_lead();

-- 7. Trigger on leads UPDATE (any meaningful change resets stagnation)
CREATE OR REPLACE FUNCTION public.trg_leads_self_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Avoid loops: only bump if columns OTHER than the stagnation/audit ones changed
  IF (
    NEW.full_name IS DISTINCT FROM OLD.full_name
    OR NEW.phone IS DISTINCT FROM OLD.phone
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.destination IS DISTINCT FROM OLD.destination
    OR NEW.travel_date_start IS DISTINCT FROM OLD.travel_date_start
    OR NEW.travel_date_end IS DISTINCT FROM OLD.travel_date_end
    OR NEW.travelers_count IS DISTINCT FROM OLD.travelers_count
    OR NEW.preferences IS DISTINCT FROM OLD.preferences
    OR NEW.budget_estimate IS DISTINCT FROM OLD.budget_estimate
    OR NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id
    OR NEW.lead_temperature IS DISTINCT FROM OLD.lead_temperature
    OR NEW.trip_profile IS DISTINCT FROM OLD.trip_profile
  ) THEN
    NEW.last_interaction_at := now();
    NEW.is_stagnant := false;
    NEW.stagnant_since := NULL;
    NEW.archive_pending_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_self_touch ON public.leads;
CREATE TRIGGER leads_self_touch
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trg_leads_self_touch();
