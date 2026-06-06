CREATE OR REPLACE VIEW public.profiles_basic
WITH (security_invoker = false) AS
SELECT user_id, full_name, email, avatar_url, phone
FROM public.profiles;

GRANT SELECT ON public.profiles_basic TO authenticated;