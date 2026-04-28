-- Add a flag to contacts to indicate that the client record was created
-- but is missing complementary data required for trip operation.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS needs_complementary_data BOOLEAN NOT NULL DEFAULT false;