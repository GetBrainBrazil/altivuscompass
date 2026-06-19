ALTER TABLE public.wa_conversations ADD COLUMN IF NOT EXISTS chat_lid text;
CREATE INDEX IF NOT EXISTS wa_conversations_chat_lid_idx ON public.wa_conversations(chat_lid) WHERE chat_lid IS NOT NULL;