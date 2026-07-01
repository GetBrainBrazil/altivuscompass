-- Limpa mensagens de grupo que gravaram o payload bruto ou eventos de sistema
DELETE FROM public.wa_messages
WHERE message_type = 'other'
  AND (
    (raw->>'callId') IS NOT NULL
    OR (raw->'notification') IS NOT NULL
    OR (raw->'notificationParameters') IS NOT NULL
    OR (content LIKE '{%"isGroup":true%' OR content LIKE '{%"instanceId"%')
  );

-- Recomputa last_message_text dos grupos afetados a partir da última mensagem real
UPDATE public.wa_conversations c
SET last_message_text = COALESCE(sub.preview, ''),
    last_message_at = sub.created_at
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    CASE
      WHEN message_type = 'text' THEN LEFT(COALESCE(content, ''), 200)
      WHEN message_type = 'image' THEN '📷 Imagem'
      WHEN message_type = 'audio' THEN '🎤 Áudio'
      WHEN message_type = 'video' THEN '🎥 Vídeo'
      WHEN message_type = 'document' THEN '📄 Documento'
      WHEN message_type = 'sticker' THEN '🌟 Figurinha'
      WHEN message_type = 'location' THEN '📍 Localização'
      WHEN message_type = 'contact' THEN '👤 Contato'
      ELSE LEFT(COALESCE(content, 'Mensagem'), 200)
    END AS preview,
    created_at
  FROM public.wa_messages
  ORDER BY conversation_id, created_at DESC
) sub
WHERE c.id = sub.conversation_id AND c.is_group = true;