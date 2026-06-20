
-- 1) Move mensagens das conversas LID que já têm uma conversa real (chat_lid bate)
WITH lid_convs AS (
  SELECT id, phone,
    CASE WHEN phone LIKE '%@lid' THEN phone ELSE phone || '@lid' END AS lid_key
  FROM public.wa_conversations
  WHERE phone LIKE '%@lid' OR (phone ~ '^[0-9]+$' AND length(phone) >= 14)
),
mergeable AS (
  SELECT l.id AS lid_id, r.id AS real_id
  FROM lid_convs l
  JOIN public.wa_conversations r ON r.chat_lid = l.lid_key
  WHERE r.id <> l.id
)
UPDATE public.wa_messages m
SET conversation_id = mg.real_id
FROM mergeable mg
WHERE m.conversation_id = mg.lid_id;

-- 2) Deleta conversas LID que foram mescladas
WITH lid_convs AS (
  SELECT id, phone,
    CASE WHEN phone LIKE '%@lid' THEN phone ELSE phone || '@lid' END AS lid_key
  FROM public.wa_conversations
  WHERE phone LIKE '%@lid' OR (phone ~ '^[0-9]+$' AND length(phone) >= 14)
),
mergeable AS (
  SELECT l.id AS lid_id
  FROM lid_convs l
  JOIN public.wa_conversations r ON r.chat_lid = l.lid_key
  WHERE r.id <> l.id
)
DELETE FROM public.wa_conversations c
USING mergeable mg
WHERE c.id = mg.lid_id;

-- 3) Para conversas LID restantes (sem real correspondente), grava chat_lid
-- para que mensagens futuras possam ser reconciliadas pelo webhook quando
-- a conversa real for criada.
UPDATE public.wa_conversations
SET chat_lid = CASE WHEN phone LIKE '%@lid' THEN phone ELSE phone || '@lid' END
WHERE (phone LIKE '%@lid' OR (phone ~ '^[0-9]+$' AND length(phone) >= 14))
  AND chat_lid IS NULL;
