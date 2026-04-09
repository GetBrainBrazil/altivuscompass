
-- Create whatsapp_sessions table
CREATE TABLE public.whatsapp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  session_type text NOT NULL DEFAULT 'financial_entry',
  state jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- No RLS policies for authenticated users - only service_role uses this table via edge functions

-- Add attachment_urls to financial_transactions
ALTER TABLE public.financial_transactions
ADD COLUMN IF NOT EXISTS attachment_urls text[] DEFAULT '{}';

-- Create financial-attachments bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-attachments', 'financial-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Allow service_role to manage files (edge functions use service_role)
CREATE POLICY "Service role can manage financial attachments"
ON storage.objects
FOR ALL
USING (bucket_id = 'financial-attachments')
WITH CHECK (bucket_id = 'financial-attachments');

-- Trigger for updated_at on whatsapp_sessions
CREATE TRIGGER update_whatsapp_sessions_updated_at
BEFORE UPDATE ON public.whatsapp_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
