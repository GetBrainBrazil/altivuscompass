
-- Create storage bucket for quote cover images
INSERT INTO storage.buckets (id, name, public) VALUES ('quote-images', 'quote-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/read/delete quote images
CREATE POLICY "Authenticated users can upload quote images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'quote-images');

CREATE POLICY "Anyone can view quote images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'quote-images');

CREATE POLICY "Authenticated users can delete quote images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'quote-images');

CREATE POLICY "Authenticated users can update quote images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'quote-images');
