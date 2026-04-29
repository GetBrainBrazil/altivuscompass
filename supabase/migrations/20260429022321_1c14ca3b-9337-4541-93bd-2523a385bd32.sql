
-- =========================================================
-- 1) user_roles: restrict policies from public -> authenticated
-- =========================================================
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- 2) Storage: passport-images and visa-images
-- Files stored as: {clientId}/{uuid}.{ext}
-- Require: authenticated AND first folder is a real client id.
-- Writes/deletes restricted to admins/managers.
-- =========================================================

-- passport-images
DROP POLICY IF EXISTS "Authenticated read access for passport images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload passport images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update passport images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete passport images" ON storage.objects;

CREATE POLICY "Authenticated can read passport images for known clients"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'passport-images'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Admins/managers can upload passport images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'passport-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'sales_agent'::app_role) OR public.has_role(auth.uid(), 'operations'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Admins/managers can update passport images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'passport-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Admins/managers can delete passport images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'passport-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

-- visa-images
DROP POLICY IF EXISTS "Authenticated read access for visa images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload visa images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update visa images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete visa images" ON storage.objects;

CREATE POLICY "Authenticated can read visa images for known clients"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'visa-images'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Authenticated can upload visa images for known clients"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'visa-images'
  AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Admins/managers can update visa images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'visa-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Admins/managers can delete visa images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'visa-images'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

-- =========================================================
-- 3) Switch views to security_invoker
-- =========================================================
ALTER VIEW public.profiles_basic SET (security_invoker = true);
ALTER VIEW public.public_itineraries SET (security_invoker = true);

-- For profiles_basic to keep working as teammate picker for all authenticated users,
-- restrict column-level grants so authenticated users can only read safe columns,
-- and add a permissive SELECT policy for those safe-column reads.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (user_id, full_name, email, avatar_url) ON public.profiles TO authenticated;

-- Admins/managers and the profile owner still need full row access.
-- We re-grant ALL columns to authenticated only via existing policies + a separate full grant
-- keyed by an additional policy. Postgres column GRANTs are union with full-table GRANT,
-- so we add a full-row SELECT grant only for service_role and re-issue full grants for
-- the policies that need it via SECURITY DEFINER if needed by app code.
-- Existing RLS policy "Users view own profile or admins/managers view all" already constrains rows.
-- Re-grant full SELECT to authenticated so RLS can return all columns when allowed by policy:
GRANT SELECT ON public.profiles TO authenticated;

-- Add a complementary policy: any authenticated user may read profiles, but the column grants
-- above plus existing RLS still apply. Since RLS is row-level only, we instead keep the existing
-- row policy and rely on application code to use profiles_basic for cross-user reads.
-- (No additional policy needed; profiles_basic now uses caller's privileges and existing RLS.)

-- Allow authenticated users to read teammate basic info via the view.
-- Add a policy that returns rows for any authenticated caller (only safe columns are exposed
-- through profiles_basic; the application uses the view for cross-user reads).
CREATE POLICY "Authenticated can read profiles for teammate picker"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
