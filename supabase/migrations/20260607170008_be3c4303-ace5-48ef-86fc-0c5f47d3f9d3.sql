
ALTER TABLE public.client_attachments
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'client-attachments';

-- Migrate passport image_urls -> client_attachments
INSERT INTO public.client_attachments (client_id, user_id, user_name, file_name, file_path, mime_type, size_bytes, passport_id, bucket, description)
SELECT
  cp.client_id,
  NULL,
  'Sistema',
  COALESCE(NULLIF(regexp_replace(url, '^.*/', ''), ''), 'imagem_passaporte'),
  regexp_replace(url, '^.*/storage/v1/object/(public/|sign/)?passport-images/', ''),
  CASE WHEN lower(url) ~ '\.png(\?|$)' THEN 'image/png'
       WHEN lower(url) ~ '\.webp(\?|$)' THEN 'image/webp'
       ELSE 'image/jpeg' END,
  NULL,
  cp.id,
  'passport-images',
  'Imagem do passaporte (migrada)'
FROM public.client_passports cp, unnest(COALESCE(cp.image_urls, '{}'::text[])) AS url
WHERE url IS NOT NULL AND url <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.client_attachments ca
    WHERE ca.passport_id = cp.id
      AND ca.file_path = regexp_replace(url, '^.*/storage/v1/object/(public/|sign/)?passport-images/', '')
  );

-- Migrate visa image_url -> client_attachments
INSERT INTO public.client_attachments (client_id, user_id, user_name, file_name, file_path, mime_type, size_bytes, visa_id, bucket, description)
SELECT
  cv.client_id,
  NULL,
  'Sistema',
  COALESCE(NULLIF(regexp_replace(cv.image_url, '^.*/', ''), ''), 'imagem_visto'),
  regexp_replace(cv.image_url, '^.*/storage/v1/object/(public/|sign/)?visa-images/', ''),
  CASE WHEN lower(cv.image_url) ~ '\.png(\?|$)' THEN 'image/png'
       WHEN lower(cv.image_url) ~ '\.webp(\?|$)' THEN 'image/webp'
       ELSE 'image/jpeg' END,
  NULL,
  cv.id,
  'visa-images',
  'Imagem do visto (migrada)'
FROM public.client_visas cv
WHERE cv.image_url IS NOT NULL AND cv.image_url <> ''
  AND cv.client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.client_attachments ca
    WHERE ca.visa_id = cv.id
      AND ca.file_path = regexp_replace(cv.image_url, '^.*/storage/v1/object/(public/|sign/)?visa-images/', '')
  );

-- Clear legacy image fields now that they're in attachments
UPDATE public.client_passports SET image_urls = '{}'::text[] WHERE image_urls IS NOT NULL AND array_length(image_urls,1) > 0;
UPDATE public.client_visas SET image_url = NULL WHERE image_url IS NOT NULL;
