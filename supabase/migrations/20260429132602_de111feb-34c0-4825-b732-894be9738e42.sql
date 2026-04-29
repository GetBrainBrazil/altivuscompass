CREATE OR REPLACE FUNCTION public.log_quote_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user text := public.current_user_display_name();
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.contact_events (lead_id, event_type, title, description, link, user_id, user_name, metadata)
    VALUES (
      NEW.lead_id,
      'quote_created',
      'Cotação criada',
      COALESCE(NEW.title, 'Nova cotação vinculada'),
      '/quotes?id=' || NEW.id::text,
      v_uid,
      v_user,
      jsonb_build_object('quote_id', NEW.id, 'title', NEW.title)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.stage IS DISTINCT FROM OLD.stage AND NEW.stage = 'sent' THEN
      INSERT INTO public.contact_events (lead_id, event_type, title, description, link, user_id, user_name, metadata)
      VALUES (
        NEW.lead_id,
        'quote_sent',
        'Cotação enviada ao cliente',
        COALESCE(NEW.title, 'Cotação'),
        '/quotes?id=' || NEW.id::text,
        v_uid,
        v_user,
        jsonb_build_object('quote_id', NEW.id, 'stage', NEW.stage)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;