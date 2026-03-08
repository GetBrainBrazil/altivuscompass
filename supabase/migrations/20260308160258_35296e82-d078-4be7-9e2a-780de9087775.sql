
ALTER TABLE public.client_visas
  ADD COLUMN IF NOT EXISTS country_region text,
  ADD COLUMN IF NOT EXISTS visa_number text,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'single';
