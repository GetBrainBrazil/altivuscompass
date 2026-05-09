UPDATE public.itinerary_day_activities
SET latitude = -26.7975624,
    longitude = -48.6186383,
    address = 'R. Goiás, 669 - Armação, Penha - SC, 88385-000'
WHERE activity_name ILIKE 'Solar Pedra da Ilha%'
  AND address ILIKE '%Maria Mansoto%';