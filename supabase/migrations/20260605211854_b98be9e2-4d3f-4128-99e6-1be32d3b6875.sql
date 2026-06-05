
CREATE TYPE public.company_brand AS ENUM ('altivus','milhas_e_voos');

ALTER TABLE public.quotes
  ADD COLUMN company public.company_brand NOT NULL DEFAULT 'altivus';

ALTER TABLE public.financial_transactions
  ADD COLUMN company public.company_brand NOT NULL DEFAULT 'altivus';

ALTER TABLE public.bank_accounts
  ADD COLUMN company public.company_brand NOT NULL DEFAULT 'altivus';
