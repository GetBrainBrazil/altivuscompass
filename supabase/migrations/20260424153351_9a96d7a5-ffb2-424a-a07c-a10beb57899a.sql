UPDATE storage.buckets SET public = true WHERE id IN ('passport-images', 'visa-images');

CREATE POLICY "Public read access for passport images"
ON storage.objects FOR SELECT
USING (bucket_id = 'passport-images');

CREATE POLICY "Public read access for visa images"
ON storage.objects FOR SELECT
USING (bucket_id = 'visa-images');