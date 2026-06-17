
-- Catálogo v1: campos opcionais aditivos na tabela products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS destination text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS images text[] DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Permitir leitura por todos os papéis autenticados (Operações também precisa ler);
-- escrita continua restrita a admin/manager pelas policies já existentes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='products' AND policyname='All authenticated can view products'
  ) THEN
    CREATE POLICY "All authenticated can view products"
      ON public.products FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
