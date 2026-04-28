-- Garante REPLICA IDENTITY FULL para payloads completos
ALTER TABLE public.leads REPLICA IDENTITY FULL;

-- Adiciona à publicação supabase_realtime (idempotente)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  EXCEPTION WHEN duplicate_object THEN
    -- Tabela já estava na publicação
    NULL;
  END;
END $$;