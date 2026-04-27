-- Tabela genérica de notificações
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: notifica admins/managers quando contato é promovido a Lead
CREATE OR REPLACE FUNCTION public.notify_contact_promoted_to_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id UUID;
  v_lead_id UUID;
BEGIN
  -- Dispara apenas na transição prospect -> lead
  IF NOT (
    (TG_OP = 'UPDATE' AND OLD.level = 'prospect' AND NEW.level = 'lead')
    OR (TG_OP = 'INSERT' AND NEW.level = 'lead')
  ) THEN
    RETURN NEW;
  END IF;

  v_lead_id := NEW.lead_id;

  -- Notifica todos os admins e managers
  FOR v_recipient_id IN
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'manager')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_recipient_id,
      'lead_promoted',
      'Novo Lead qualificado',
      COALESCE(NEW.full_name, 'Contato sem nome') || ' foi promovido para Lead e está no funil de vendas.',
      CASE WHEN v_lead_id IS NOT NULL THEN '/leads/' || v_lead_id::text ELSE '/contacts' END,
      jsonb_build_object('contact_id', NEW.id, 'lead_id', v_lead_id, 'phone', NEW.phone)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_contact_promoted_to_lead ON public.contacts;
CREATE TRIGGER trg_notify_contact_promoted_to_lead
AFTER INSERT OR UPDATE OF level ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.notify_contact_promoted_to_lead();