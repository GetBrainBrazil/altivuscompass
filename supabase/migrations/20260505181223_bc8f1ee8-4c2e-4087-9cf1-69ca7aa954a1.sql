ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS collected_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS client_context_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS last_resumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS resumed_from_status text,
  ADD COLUMN IF NOT EXISTS days_inactive_on_resume integer;

CREATE INDEX IF NOT EXISTS idx_wa_messages_convo_created_desc
  ON public.wa_messages (conversation_id, created_at DESC);