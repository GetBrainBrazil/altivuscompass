ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent';
-- valores possíveis: 'pending' | 'sent' | 'received' (entregue) | 'read' | 'played' | 'failed'
CREATE INDEX IF NOT EXISTS idx_wa_messages_zapi_message_id ON public.wa_messages (zapi_message_id);