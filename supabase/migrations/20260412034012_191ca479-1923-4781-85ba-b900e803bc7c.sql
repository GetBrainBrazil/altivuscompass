
-- Drop old text columns and add UUID references to airports table
ALTER TABLE public.itineraries DROP COLUMN IF EXISTS arrival_airport;
ALTER TABLE public.itineraries DROP COLUMN IF EXISTS departure_airport;

ALTER TABLE public.itineraries ADD COLUMN arrival_airport_id uuid REFERENCES public.airports(id) ON DELETE SET NULL;
ALTER TABLE public.itineraries ADD COLUMN departure_airport_id uuid REFERENCES public.airports(id) ON DELETE SET NULL;
