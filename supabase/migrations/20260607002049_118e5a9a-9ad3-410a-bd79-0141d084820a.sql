INSERT INTO public.platform_changelog (title, description, category, module, date) VALUES (
  'Etapa 4: Produto ↔ Item (Catálogo Sincronizado)',
  'Criação da camada de produtos com busca tolerante (pg_trgm + unaccent + índice GIN). UI de autocomplete com criação inline em quote_items. product_id adicionado à tabela quote_items. Catálogo de produtos nasce do zero e se preenche organicamente pelo uso — nenhum backfill foi aplicado ao legado (29 itens existentes permanecem product_id NULL com flag "produto não cadastrado"). Valores reais de unit_cost/unit_price dos itens não foram tocados; margem continua lendo do item. Edge accept-quote, deals, deal_events e triggers de negócio permanecem intocados.',
  'melhoria',
  'Geral',
  now()
);