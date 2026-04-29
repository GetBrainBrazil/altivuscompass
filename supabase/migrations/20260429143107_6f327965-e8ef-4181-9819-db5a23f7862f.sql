
-- 1) Drop unused SECURITY DEFINER view flagged by linter
DROP VIEW IF EXISTS public.profiles_basic;

-- 2) Tighten financial-attachments storage: only admin/manager + users in finance role
DROP POLICY IF EXISTS "Authenticated can manage financial attachments" ON storage.objects;

CREATE POLICY "Finance staff can manage financial attachments"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'financial-attachments'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
)
WITH CHECK (
  bucket_id = 'financial-attachments'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

-- 3) Restrict realtime channel subscriptions: deny unknown topics by default
DROP POLICY IF EXISTS "Authenticated can read own user-scoped channels" ON realtime.messages;

CREATE POLICY "Authenticated realtime topic access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'notifications:%'
      THEN realtime.topic() = 'notifications:' || auth.uid()::text
    WHEN realtime.topic() LIKE 'task_reminders:%'
      THEN realtime.topic() = 'task_reminders:' || auth.uid()::text
    WHEN realtime.topic() IN ('leads', 'contact_events', 'wa_conversations', 'wa_messages', 'notifications', 'quotes', 'tasks')
      THEN true
    ELSE false
  END
);

-- 4) whatsapp_sessions: add explicit admin-only policies (RLS already enabled, no policies = blocked)
CREATE POLICY "Admins can view whatsapp sessions"
ON public.whatsapp_sessions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage whatsapp sessions"
ON public.whatsapp_sessions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
