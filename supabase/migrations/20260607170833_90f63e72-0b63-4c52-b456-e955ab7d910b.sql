
CREATE POLICY "Authenticated users can update client attachments"
ON public.client_attachments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

INSERT INTO public.client_attachments (
  client_id, user_id, user_name, file_name, file_path, mime_type, size_bytes,
  description, passport_id, visa_id, category, bucket
)
SELECT
  '8f98f504-f389-4fa6-a14f-3d8a4237438f'::uuid,
  NULL, 'Migração',
  'visto rodrigo (migrada).jpg',
  '8f98f504-f389-4fa6-a14f-3d8a4237438f/a862ca19-58b0-4f6b-bde9-38dced70c1cb.jpg',
  'image/jpeg',
  (SELECT (metadata->>'size')::bigint FROM storage.objects WHERE bucket_id='visa-images' AND name='8f98f504-f389-4fa6-a14f-3d8a4237438f/a862ca19-58b0-4f6b-bde9-38dced70c1cb.jpg'),
  'Imagem do visto (migrada)',
  '39ab7cc3-3091-48d9-835f-0b3c3642977b'::uuid,
  NULL, NULL, 'visa-images'
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_attachments
  WHERE file_path = '8f98f504-f389-4fa6-a14f-3d8a4237438f/a862ca19-58b0-4f6b-bde9-38dced70c1cb.jpg'
);
