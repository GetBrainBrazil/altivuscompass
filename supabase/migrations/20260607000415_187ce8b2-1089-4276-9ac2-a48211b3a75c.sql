
-- Extensions for tolerant search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1) quote_items.product_id (nullable na transição)
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON public.quote_items(product_id);

-- 2) products.item_type opcional para filtrar busca por tipo
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS item_type text;

-- 3) Função imutável para normalizar (unaccent + lower)
CREATE OR REPLACE FUNCTION public.norm_text(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(public.unaccent(coalesce(t, '')));
$$;

-- 4) Índice GIN de similaridade no nome do produto
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON public.products USING gin (public.norm_text(name) gin_trgm_ops);

-- 5) RPC search_products(q, _type)
CREATE OR REPLACE FUNCTION public.search_products(q text, _type text DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  name text,
  item_type text,
  supplier_id uuid,
  cost numeric,
  sale_price numeric,
  currency text,
  similarity real
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH qn AS (SELECT public.norm_text(q) AS nq)
  SELECT p.id, p.name, p.item_type, p.supplier_id, p.cost, p.sale_price, p.currency,
         similarity(public.norm_text(p.name), (SELECT nq FROM qn)) AS similarity
  FROM public.products p, qn
  WHERE p.is_active = true
    AND (_type IS NULL OR p.item_type IS NULL OR p.item_type = _type)
    AND (
      qn.nq = '' OR
      public.norm_text(p.name) % qn.nq OR
      public.norm_text(p.name) ILIKE '%' || qn.nq || '%'
    )
  ORDER BY similarity DESC NULLS LAST, p.name ASC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, text) TO authenticated, anon;

-- 6) RPC dry_run_backfill_product_id() — apenas RELATÓRIO, não altera dados
CREATE OR REPLACE FUNCTION public.dry_run_backfill_product_id()
RETURNS TABLE(
  bucket text,                -- 'high_confidence' | 'low_confidence' | 'no_match'
  quote_item_id uuid,
  item_type text,
  item_title text,
  item_supplier_id uuid,
  candidate_product_id uuid,
  candidate_product_name text,
  similarity real,
  same_supplier boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT qi.id AS quote_item_id,
           qi.item_type,
           qi.title AS item_title,
           qi.supplier_id AS item_supplier_id,
           p.id AS candidate_product_id,
           p.name AS candidate_product_name,
           similarity(public.norm_text(qi.title), public.norm_text(p.name)) AS sim,
           (p.supplier_id IS NOT NULL AND qi.supplier_id IS NOT NULL AND p.supplier_id = qi.supplier_id) AS same_supplier,
           ROW_NUMBER() OVER (
             PARTITION BY qi.id
             ORDER BY
               (p.supplier_id IS NOT NULL AND qi.supplier_id IS NOT NULL AND p.supplier_id = qi.supplier_id) DESC,
               similarity(public.norm_text(qi.title), public.norm_text(p.name)) DESC
           ) AS rn
    FROM public.quote_items qi
    LEFT JOIN public.products p
      ON p.is_active = true
     AND (p.item_type IS NULL OR p.item_type = qi.item_type)
     AND qi.title IS NOT NULL AND length(trim(qi.title)) > 0
     AND similarity(public.norm_text(qi.title), public.norm_text(p.name)) > 0.25
    WHERE qi.product_id IS NULL
  )
  SELECT
    CASE
      WHEN candidate_product_id IS NULL THEN 'no_match'
      WHEN (same_supplier AND sim >= 0.55) OR sim >= 0.80 THEN 'high_confidence'
      ELSE 'low_confidence'
    END AS bucket,
    quote_item_id, item_type, item_title, item_supplier_id,
    candidate_product_id, candidate_product_name, sim AS similarity, same_supplier
  FROM ranked
  WHERE rn = 1 OR rn IS NULL
  ORDER BY bucket, similarity DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.dry_run_backfill_product_id() TO authenticated;
