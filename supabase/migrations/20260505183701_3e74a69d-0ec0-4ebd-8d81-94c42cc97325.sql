-- Trigger to notify admins/managers when a wa_conversation switches to human (handoff)
CREATE OR REPLACE FUNCTION public.notify_wa_conversation_handoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_title TEXT;
  v_msg TEXT;
BEGIN
  IF NEW.status = 'human' AND (OLD.status IS DISTINCT FROM 'human') THEN
    v_title := 'Atendimento humano solicitado';
    v_msg := COALESCE(NEW.contact_name, NEW.phone) || ' precisa de um(a) consultor(a).';
    FOR v_user IN
      SELECT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin', 'manager')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
      VALUES (
        v_user.user_id,
        'wa_handoff',
        v_title,
        v_msg,
        '/service-center?phone=' || NEW.phone,
        jsonb_build_object('conversation_id', NEW.id, 'phone', NEW.phone, 'contact_name', NEW.contact_name)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_wa_handoff ON public.wa_conversations;
CREATE TRIGGER trg_notify_wa_handoff
AFTER UPDATE OF status ON public.wa_conversations
FOR EACH ROW
EXECUTE FUNCTION public.notify_wa_conversation_handoff();