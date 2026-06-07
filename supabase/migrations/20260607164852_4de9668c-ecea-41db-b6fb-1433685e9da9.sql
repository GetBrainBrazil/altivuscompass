ALTER TABLE public.client_attachments
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS passport_id uuid REFERENCES public.client_passports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visa_id uuid REFERENCES public.client_visas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS client_attachments_passport_idx ON public.client_attachments(passport_id);
CREATE INDEX IF NOT EXISTS client_attachments_visa_idx ON public.client_attachments(visa_id);