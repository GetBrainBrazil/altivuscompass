
-- Table for bank account access credentials
CREATE TABLE public.bank_account_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  login_username TEXT,
  access_password TEXT,
  transaction_password TEXT,
  has_facial BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table: which users can view each credential
CREATE TABLE public.bank_account_credential_viewers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credential_id UUID NOT NULL REFERENCES public.bank_account_credentials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(credential_id, user_id)
);

-- Enable RLS
ALTER TABLE public.bank_account_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_account_credential_viewers ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can do everything on credentials
CREATE POLICY "Admins can manage credentials"
  ON public.bank_account_credentials FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Users can view credentials they are viewers of
CREATE POLICY "Viewers can see their credentials"
  ON public.bank_account_credentials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bank_account_credential_viewers
      WHERE credential_id = id AND user_id = auth.uid()
    )
  );

-- RLS: Admins can manage credential_viewers
CREATE POLICY "Admins can manage credential_viewers"
  ON public.bank_account_credential_viewers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Users can view their own viewer records
CREATE POLICY "Users can view own viewer records"
  ON public.bank_account_credential_viewers FOR SELECT
  USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_bank_account_credentials_updated_at
  BEFORE UPDATE ON public.bank_account_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
