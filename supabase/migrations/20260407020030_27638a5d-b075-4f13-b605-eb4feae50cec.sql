
-- Main itineraries table
CREATE TABLE public.itineraries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  destination TEXT,
  traveler_profile TEXT,
  travel_date_start DATE,
  travel_date_end DATE,
  main_bases TEXT,
  base_file TEXT,
  notes TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage itineraries" ON public.itineraries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_itineraries_updated_at
  BEFORE UPDATE ON public.itineraries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily schedule
CREATE TABLE public.itinerary_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itinerary_id UUID NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  day_date DATE,
  city TEXT,
  morning_activity TEXT,
  afternoon_activity TEXT,
  evening_activity TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage itinerary_days" ON public.itinerary_days
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Hotels
CREATE TABLE public.itinerary_hotels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itinerary_id UUID NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  city_base TEXT,
  hotel_name TEXT NOT NULL,
  hotel_type TEXT,
  check_in DATE,
  check_out DATE,
  nights INT,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.itinerary_hotels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage itinerary_hotels" ON public.itinerary_hotels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Restaurants
CREATE TABLE public.itinerary_restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itinerary_id UUID NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  city_base TEXT,
  restaurant_name TEXT NOT NULL,
  cuisine_type TEXT,
  best_fit TEXT,
  reason TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.itinerary_restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage itinerary_restaurants" ON public.itinerary_restaurants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Activities / Tours
CREATE TABLE public.itinerary_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itinerary_id UUID NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  activity_name TEXT NOT NULL,
  approx_price NUMERIC(10,2),
  avg_duration TEXT,
  period TEXT,
  description TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.itinerary_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage itinerary_activities" ON public.itinerary_activities
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
