
-- Add image_urls column to client_passports for multiple photos
ALTER TABLE public.client_passports ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}'::text[];

-- Create storage bucket for passport images
INSERT INTO storage.buckets (id, name, public) VALUES ('passport-images', 'passport-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload passport images
CREATE POLICY "Authenticated users can upload passport images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'passport-images');

-- Allow authenticated users to update passport images
CREATE POLICY "Authenticated users can update passport images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'passport-images');

-- Allow authenticated users to delete passport images
CREATE POLICY "Authenticated users can delete passport images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'passport-images');

-- Allow public read access to passport images
CREATE POLICY "Public read access for passport images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'passport-images');
