
-- 1. Fix profiles policies: change from public to authenticated
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Authenticated users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Authenticated users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 2. Make passport-images and visa-images buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('passport-images', 'visa-images');

-- 3. Fix storage policies for passport-images
DROP POLICY IF EXISTS "Public read access for passport images" ON storage.objects;
CREATE POLICY "Authenticated read access for passport images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'passport-images');

-- 4. Fix storage policies for visa-images
DROP POLICY IF EXISTS "Public read access for visa images" ON storage.objects;
CREATE POLICY "Authenticated read access for visa images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'visa-images');

-- 5. Fix broken bank_account_credentials viewer policy
DROP POLICY IF EXISTS "Viewers can see their credentials" ON public.bank_account_credentials;
CREATE POLICY "Viewers can see their credentials" ON public.bank_account_credentials
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bank_account_credential_viewers
      WHERE credential_id = bank_account_credentials.id
        AND user_id = auth.uid()
    )
  );

-- 6. Fix audit_logs INSERT policy: change from public to authenticated
DROP POLICY IF EXISTS "Authenticated can insert audit_logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- 7. Fix audit_logs SELECT policy: ensure it's authenticated too
DROP POLICY IF EXISTS "Admins can view audit_logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. Fix bank_account_credential_viewers policies from public to authenticated
DROP POLICY IF EXISTS "Admins can manage credential_viewers" ON public.bank_account_credential_viewers;
CREATE POLICY "Admins can manage credential_viewers" ON public.bank_account_credential_viewers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own viewer records" ON public.bank_account_credential_viewers;
CREATE POLICY "Users can view own viewer records" ON public.bank_account_credential_viewers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 9. Fix bank_account_credentials admin policy from public to authenticated
DROP POLICY IF EXISTS "Admins can manage credentials" ON public.bank_account_credentials;
CREATE POLICY "Admins can manage credentials" ON public.bank_account_credentials
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
