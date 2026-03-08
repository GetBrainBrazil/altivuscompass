
ALTER TABLE public.client_phones ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
ALTER TABLE public.client_emails ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
