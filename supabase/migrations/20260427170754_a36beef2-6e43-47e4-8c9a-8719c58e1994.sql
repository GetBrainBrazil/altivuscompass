-- Add fields to financial_transactions to support the Payables/Receivables module
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS cost_center text,
  ADD COLUMN IF NOT EXISTS project text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS competence_date date,
  ADD COLUMN IF NOT EXISTS bank_account_id uuid,
  ADD COLUMN IF NOT EXISTS base_amount numeric,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fine_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_fee_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installment_total integer,
  ADD COLUMN IF NOT EXISTS installment_group_id uuid,
  ADD COLUMN IF NOT EXISTS recurrence_type text,
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid,
  ADD COLUMN IF NOT EXISTS is_future_recurrence boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_client_id ON public.financial_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_supplier_id ON public.financial_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_due_date ON public.financial_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type_status ON public.financial_transactions(type, status);