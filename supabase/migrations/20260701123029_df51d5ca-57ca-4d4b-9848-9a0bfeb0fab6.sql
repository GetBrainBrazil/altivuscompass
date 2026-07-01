DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT a.id AS lid_id, b.id AS real_id
    FROM public.wa_conversations a
    JOIN public.wa_conversations b
      ON a.chat_lid = b.chat_lid AND a.id <> b.id
    WHERE a.phone LIKE '%@lid' AND b.phone NOT LIKE '%@lid'
  LOOP
    UPDATE public.wa_messages
       SET conversation_id = r.real_id
     WHERE conversation_id = r.lid_id;
    DELETE FROM public.wa_conversations WHERE id = r.lid_id;
  END LOOP;
END $$;