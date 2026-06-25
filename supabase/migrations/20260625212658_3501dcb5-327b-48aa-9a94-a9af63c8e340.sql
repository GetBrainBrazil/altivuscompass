
CREATE TABLE IF NOT EXISTS public.permission_settings (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.permission_settings TO authenticated;
GRANT ALL ON public.permission_settings TO service_role;

ALTER TABLE public.permission_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permission_settings_select_auth"
ON public.permission_settings FOR SELECT
TO authenticated USING (true);

CREATE POLICY "permission_settings_admin_insert"
ON public.permission_settings FOR INSERT
TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "permission_settings_admin_update"
ON public.permission_settings FOR UPDATE
TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.permission_settings;
ALTER TABLE public.permission_settings REPLICA IDENTITY FULL;
