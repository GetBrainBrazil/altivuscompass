
CREATE TABLE public.hotel_photo_cache (
  query_key TEXT PRIMARY KEY,
  photo_url TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hotel_photo_cache TO anon, authenticated;
GRANT ALL ON public.hotel_photo_cache TO service_role;
ALTER TABLE public.hotel_photo_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read hotel photo cache" ON public.hotel_photo_cache FOR SELECT USING (true);
