
-- Add new columns to itineraries for AI-powered generation
ALTER TABLE public.itineraries
  ADD COLUMN IF NOT EXISTS arrival_datetime timestamptz,
  ADD COLUMN IF NOT EXISTS departure_datetime timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_airport text,
  ADD COLUMN IF NOT EXISTS departure_airport text,
  ADD COLUMN IF NOT EXISTS traveler_type text,
  ADD COLUMN IF NOT EXISTS trip_style text,
  ADD COLUMN IF NOT EXISTS wake_time time,
  ADD COLUMN IF NOT EXISTS sleep_time time,
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS public_editable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS desired_places text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS defined_hotels text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_hotels text[] DEFAULT '{}';

-- Create index on public_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_itineraries_public_token ON public.itineraries (public_token) WHERE public_token IS NOT NULL;

-- Create granular day activities table
CREATE TABLE public.itinerary_day_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_day_id uuid NOT NULL REFERENCES public.itinerary_days(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  activity_name text NOT NULL,
  description text,
  activity_type text DEFAULT 'attraction',
  start_time time,
  end_time time,
  latitude double precision,
  longitude double precision,
  address text,
  -- Transport FROM previous point TO this point
  transport_mode text,
  transport_departure_time time,
  transport_arrival_time time,
  transport_duration_min integer,
  transport_cost_estimate numeric,
  transport_currency text DEFAULT 'BRL',
  transport_notes text,
  is_ai_suggested boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.itinerary_day_activities ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage activities
CREATE POLICY "Authenticated users can manage itinerary_day_activities"
  ON public.itinerary_day_activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Public read access via public_token (join through itinerary_days -> itineraries)
CREATE POLICY "Public can view activities of public itineraries"
  ON public.itinerary_day_activities
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.itinerary_days d
      JOIN public.itineraries i ON i.id = d.itinerary_id
      WHERE d.id = itinerary_day_activities.itinerary_day_id
        AND i.public_token IS NOT NULL
    )
  );

-- Public read for itinerary_days via public_token
CREATE POLICY "Public can view days of public itineraries"
  ON public.itinerary_days
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries i
      WHERE i.id = itinerary_days.itinerary_id
        AND i.public_token IS NOT NULL
    )
  );

-- Public read for itineraries with public_token
CREATE POLICY "Public can view public itineraries"
  ON public.itineraries
  FOR SELECT
  TO anon
  USING (public_token IS NOT NULL);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_day_activities_day_id ON public.itinerary_day_activities (itinerary_day_id);
CREATE INDEX IF NOT EXISTS idx_day_activities_sort ON public.itinerary_day_activities (itinerary_day_id, sort_order);
