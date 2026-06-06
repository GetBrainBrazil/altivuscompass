
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigner_name text;
  task_title text;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to = NEW.created_by THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, email, 'Alguém')
    INTO assigner_name
    FROM public.profiles
   WHERE id = NEW.created_by;

  task_title := COALESCE(NEW.title, 'Sem título');

  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (
    NEW.assigned_to,
    'task_assigned',
    'Nova tarefa atribuída',
    COALESCE(assigner_name, 'Alguém') || ' atribuiu a tarefa "' || task_title || '" para você.',
    '/tasks/' || NEW.id::text,
    jsonb_build_object(
      'task_id', NEW.id,
      'assigned_by', NEW.created_by,
      'task_title', task_title
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned_ins ON public.tasks;
DROP TRIGGER IF EXISTS trg_notify_task_assigned_upd ON public.tasks;

CREATE TRIGGER trg_notify_task_assigned_ins
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assigned();

CREATE TRIGGER trg_notify_task_assigned_upd
AFTER UPDATE OF assigned_to ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assigned();
