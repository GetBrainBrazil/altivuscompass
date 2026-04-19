ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS client_notes TEXT;