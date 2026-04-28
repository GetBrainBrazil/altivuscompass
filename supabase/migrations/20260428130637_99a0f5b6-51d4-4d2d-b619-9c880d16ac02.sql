
-- 1) Restrict profiles SELECT to owner / admin / manager
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users view own profile or admins/managers view all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

-- 2) Safe view for cross-user identity lookups
CREATE OR REPLACE VIEW public.profiles_basic
WITH (security_invoker = true)
AS
SELECT user_id, full_name, email, avatar_url
FROM public.profiles;

GRANT SELECT ON public.profiles_basic TO authenticated;

-- The view needs its own permissive policy on the underlying table for authenticated reads
-- of just these safe columns. We add a dedicated SELECT policy that only matches the
-- view's projection by being checked at the view layer (security_invoker uses caller's
-- privileges, so we add a complementary policy).
CREATE POLICY "Authenticated can read basic profile fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- NOTE: With security_invoker views and two SELECT policies (permissive OR),
-- the broad policy would defeat the restriction. So instead we drop the broad one
-- and switch the view to security_definer with a fixed search path.
DROP POLICY IF EXISTS "Authenticated can read basic profile fields" ON public.profiles;

CREATE OR REPLACE VIEW public.profiles_basic
WITH (security_invoker = false)
AS
SELECT user_id, full_name, email, avatar_url
FROM public.profiles;

GRANT SELECT ON public.profiles_basic TO authenticated;

-- 3) Public itineraries: drop policy that exposed full row, replace with a
--    safe view limited to non-sensitive columns.
DROP POLICY IF EXISTS "Public can view public itineraries" ON public.itineraries;

CREATE OR REPLACE VIEW public.public_itineraries
WITH (security_invoker = false)
AS
SELECT
  id,
  title,
  destination,
  arrival_datetime,
  departure_datetime,
  arrival_airport_id,
  departure_airport_id,
  wake_time,
  sleep_time,
  notes,
  summary,
  ai_status,
  public_token,
  created_at,
  updated_at
FROM public.itineraries
WHERE public_token IS NOT NULL;

GRANT SELECT ON public.public_itineraries TO anon, authenticated;
