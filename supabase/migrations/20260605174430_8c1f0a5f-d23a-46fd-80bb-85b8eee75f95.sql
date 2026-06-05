ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_id text,
  ADD COLUMN IF NOT EXISTS group_subject text,
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS wa_conversations_group_id_key
  ON public.wa_conversations (group_id) WHERE group_id IS NOT NULL;

ALTER TABLE public.wa_messages
  ADD COLUMN IF NOT EXISTS sender_phone text,
  ADD COLUMN IF NOT EXISTS sender_name text;