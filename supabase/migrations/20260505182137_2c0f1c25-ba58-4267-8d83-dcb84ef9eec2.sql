
-- Trigger function that calls the summarize-wa-conversation edge function
-- when a conversation is moved to resolved/abandoned status.
CREATE OR REPLACE FUNCTION public.trigger_summarize_wa_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_anon text;
BEGIN
  -- Only act when status transitions INTO resolved or abandoned
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('resolved', 'abandoned')
     AND (NEW.summary IS NULL OR length(trim(NEW.summary)) = 0)
  THEN
    v_url := 'https://fuaaackbubqxkkdvbvpi.supabase.co/functions/v1/summarize-wa-conversation';
    v_anon := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YWFhY2tidWJxeGtrZHZidnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE4NjEsImV4cCI6MjA4ODQ2Nzg2MX0.nJOjmB3zBnR_Jt_GBOOPEX9ym5GzugdjwXagHUu2ejw';

    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon
      ),
      body := jsonb_build_object('conversation_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the status update if summarization scheduling fails
  RAISE WARNING 'trigger_summarize_wa_conversation error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wa_conversations_summarize_on_close ON public.wa_conversations;
CREATE TRIGGER wa_conversations_summarize_on_close
AFTER UPDATE OF status ON public.wa_conversations
FOR EACH ROW
EXECUTE FUNCTION public.trigger_summarize_wa_conversation();
