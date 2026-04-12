ALTER TABLE public.itineraries
ADD COLUMN quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;