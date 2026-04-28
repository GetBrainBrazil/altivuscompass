
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS first_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_returning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_returning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;

-- Backfill básico a partir das conversas existentes (se houver)
UPDATE public.contacts c
SET first_contact_at = sub.first_at,
    last_contact_at  = sub.last_at
FROM (
  SELECT contact_id,
         MIN(last_message_at) AS first_at,
         MAX(last_message_at) AS last_at
  FROM public.wa_conversations
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
) sub
WHERE c.id = sub.contact_id
  AND (c.first_contact_at IS NULL OR c.last_contact_at IS NULL);

-- Para contatos sem conversa, usa created_at como primeiro contato
UPDATE public.contacts
SET first_contact_at = COALESCE(first_contact_at, created_at),
    last_contact_at  = COALESCE(last_contact_at, created_at);
