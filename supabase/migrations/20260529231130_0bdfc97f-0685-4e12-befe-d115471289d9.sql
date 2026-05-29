UPDATE public.wa_conversations
SET last_message_text = 'Recebi seu arquivo! Pode me contar em texto também o que você está procurando? (destino, datas, quantas pessoas)',
    last_message_from = 'agent'
WHERE id = 'a85a7492-8ad2-43cd-9eb5-6337d7ea3e69'
  AND last_message_text LIKE '{%';