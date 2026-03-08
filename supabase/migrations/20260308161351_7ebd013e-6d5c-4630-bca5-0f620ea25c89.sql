-- Add image_url column to client_visas
ALTER TABLE public.client_visas ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for visa images
INSERT INTO storage.buckets (id, name, public) VALUES ('visa-images', 'visa-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload visa images
CREATE POLICY "Authenticated users can upload visa images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'visa-images');

-- Allow authenticated users to update visa images
CREATE POLICY "Authenticated users can update visa images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'visa-images');

-- Allow authenticated users to delete visa images
CREATE POLICY "Authenticated users can delete visa images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'visa-images');

-- Allow public read access to visa images
CREATE POLICY "Public read access for visa images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'visa-images');