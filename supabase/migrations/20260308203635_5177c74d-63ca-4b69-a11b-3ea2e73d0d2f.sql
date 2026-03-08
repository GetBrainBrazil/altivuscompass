
CREATE TABLE public.bank_account_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bank_account_id, user_id)
);

ALTER TABLE public.bank_account_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bank_account_access"
  ON public.bank_account_access FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own bank_account_access"
  ON public.bank_account_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
