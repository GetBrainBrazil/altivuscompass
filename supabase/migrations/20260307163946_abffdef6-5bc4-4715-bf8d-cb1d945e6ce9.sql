-- Add category column to financial_transactions for payable/receivable
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS category text DEFAULT 'receivable';
-- Add due_date for tracking payment due dates  
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS due_date date;
-- Add party reference
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS party_name text;