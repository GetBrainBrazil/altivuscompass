-- Allow anon to read itineraries that have a public token
CREATE POLICY "Public can view itineraries with public token"
ON public.itineraries
FOR SELECT
TO anon
USING (public_token IS NOT NULL);

-- Allow anon to read airports (reference data, used by public itinerary)
CREATE POLICY "Public can view airports"
ON public.airports
FOR SELECT
TO anon
USING (true);

-- Grant select on the public itineraries view to anon and authenticated
GRANT SELECT ON public.public_itineraries TO anon, authenticated;