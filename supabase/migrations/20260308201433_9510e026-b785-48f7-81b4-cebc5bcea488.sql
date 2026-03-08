
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS is_reconciled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS virtual_account_owner text,
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS payment_account text;
