
-- Make passport and visa buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('passport-images', 'visa-images');

-- Drop public read policies
DROP POLICY IF EXISTS "Public read access for passport images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for visa images" ON storage.objects;
