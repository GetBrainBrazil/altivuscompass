-- Conversas e mensagens da Central de Atendimento (WhatsApp via Z-API)

CREATE TABLE IF NOT EXISTS public.wa_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  contact_id UUID,
  lead_id UUID,
  client_id UUID,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_from TEXT, -- 'lead' | 'agent' | 'ai'
  unread_count INTEGER NOT NULL DEFAULT 0,
  is_group BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'ai', -- 'ai' | 'human'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_conversations_last_message_at
  ON public.wa_conversations (last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_phone
  ON public.wa_conversations (phone);

CREATE TABLE IF NOT EXISTS public.wa_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, -- 'in' | 'out'
  sender TEXT NOT NULL,    -- 'lead' | 'agent' | 'ai'
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'other'
  content TEXT,
  media_url TEXT,
  media_mime TEXT,
  media_caption TEXT,
  zapi_message_id TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation_id_created_at
  ON public.wa_messages (conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_messages_zapi_id
  ON public.wa_messages (zapi_message_id) WHERE zapi_message_id IS NOT NULL;

-- updated_at trigger em conversations
DROP TRIGGER IF EXISTS trg_wa_conversations_updated_at ON public.wa_conversations;
CREATE TRIGGER trg_wa_conversations_updated_at
  BEFORE UPDATE ON public.wa_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: usuários autenticados acessam tudo (mesma política das outras tabelas operacionais)
ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wa_conversations"
  ON public.wa_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert wa_conversations"
  ON public.wa_conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update wa_conversations"
  ON public.wa_conversations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins/managers can delete wa_conversations"
  ON public.wa_conversations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view wa_messages"
  ON public.wa_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert wa_messages"
  ON public.wa_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update wa_messages"
  ON public.wa_messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins/managers can delete wa_messages"
  ON public.wa_messages FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Realtime
ALTER TABLE public.wa_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.wa_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;