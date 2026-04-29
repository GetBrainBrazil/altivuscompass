
CREATE OR REPLACE VIEW public.profiles_basic AS
SELECT user_id, full_name, email, avatar_url
FROM public.profiles;

ALTER VIEW public.profiles_basic SET (security_invoker = false);
REVOKE ALL ON public.profiles_basic FROM PUBLIC, anon;
GRANT SELECT ON public.profiles_basic TO authenticated;
