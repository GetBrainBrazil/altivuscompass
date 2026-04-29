
-- 1) Drop overly permissive blanket SELECT on profiles
DROP POLICY IF EXISTS "Authenticated can read profiles for teammate picker" ON public.profiles;

-- 2) Make profiles_basic a SECURITY DEFINER view so authenticated users
--    can read non-sensitive teammate fields (full_name, email, avatar_url)
--    without exposing phone/address/emergency contact/health_plan/cep.
ALTER VIEW public.profiles_basic SET (security_invoker = false);
REVOKE ALL ON public.profiles_basic FROM PUBLIC, anon;
GRANT SELECT ON public.profiles_basic TO authenticated;

-- 3) Tighten the financial-attachments storage policy:
--    restrict to authenticated users (was: public role -> anon could access)
DROP POLICY IF EXISTS "Service role can manage financial attachments" ON storage.objects;
CREATE POLICY "Authenticated can manage financial attachments"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'financial-attachments')
WITH CHECK (bucket_id = 'financial-attachments');

-- 4) Realtime: restrict authenticated subscriptions on realtime.messages so
--    user-scoped channels (notifications:<uid>, task_reminders:<uid>) are
--    only readable by the matching user. Other topics remain accessible to
--    any authenticated user (existing behavior for shared channels like
--    wa_messages, leads, etc.).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own user-scoped channels" ON realtime.messages;
CREATE POLICY "Authenticated can read own user-scoped channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'notifications:%'
      THEN realtime.topic() = 'notifications:' || auth.uid()::text
    WHEN realtime.topic() LIKE 'task_reminders:%'
      THEN realtime.topic() = 'task_reminders:' || auth.uid()::text
    ELSE true
  END
);
