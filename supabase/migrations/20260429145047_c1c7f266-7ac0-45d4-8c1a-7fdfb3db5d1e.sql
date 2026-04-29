-- Audit logs: prevent forging entries as another user
DROP POLICY IF EXISTS "Authenticated can insert audit_logs" ON public.audit_logs;

CREATE POLICY "Users can insert own audit_logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Notifications: prevent users from sending notifications to others
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());