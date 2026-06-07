# Fase 2 — Construtor Modular de Itens na Cotação

Retomando de onde paramos. **Fase 1 entregue** (campos por categoria + página `/registrations/categories/:id/fields`). Esta fase adiciona uma nova forma de montar a cotação convivendo com as abas fixas atuais — nada existente é removido.

Decisões já confirmadas:
- Fluxo de adição: **busca global de produto, agrupado por categoria**, com atalho para criar produto novo
- Layout: **lista + tela dedicada** (estilo Cofre/Categorias)
- Nova aba convive com as abas fixas (Voo/Hotel/Transporte continuam)

## O que muda na UI

### 1. Nova aba "Itens" no editor de cotação (`src/pages/Quotes.tsx`)
- Adicionar `<TabsTrigger value="modular">Itens</TabsTrigger>` logo após "Principal" e antes das abas dinâmicas por tipo.
- `<TabsContent value="modular">` renderiza `<QuoteModularItemsList quoteId={...} items={items} onChanged={refetch} />`.
- Nenhuma aba existente é tocada nesta fase.

### 2. `src/components/quotes/QuoteModularItemsList.tsx` (novo)
- Cabeçalho: botão **+ Adicionar item** (abre `ProductSearchDialog`).
- Lista: cada linha mostra ícone da categoria, título do item, categoria, preço unitário, quantidade, total. Linha inteira clicável → `/quotes/:quoteId/items/:itemId`.
- Drag handle para reordenar (`sort_order`).
- Estado vazio: "Nenhum item adicionado" + CTA.

### 3. `src/components/quotes/ProductSearchDialog.tsx` (novo)
Modal compacto, com 3 elementos no topo fixo:
1. **Campo de busca global** (debounce 250ms) — filtra produtos por `name ilike` em todas as categorias ao mesmo tempo.
2. Botão **+ Novo produto** no canto superior direito — abre o cadastro rápido já existente (reusa o `Dialog` interno do `QuoteItemProductPicker`, que insere em `products` com nome/custo/preço/categoria e devolve o registro pronto pra ser escolhido).
3. Lista de resultados **agrupada por categoria** (`Voo`, `Hospedagem`, `Locação`, custom...): cabeçalho da categoria sticky, abaixo as opções daquele grupo com nome + preço-base à direita. Grupos vazios (sem match na busca) ficam ocultos.

Comportamentos:
- Sem texto digitado: lista todas as categorias com seus produtos (até 50 por grupo, com "ver mais" se houver mais).
- Com texto: filtra por nome dentro de cada grupo; categorias sem match somem.
- Rodapé: link discreto **"Criar item sem produto"** → abre um seletor simples de categoria e cria item solto (`product_id = null`).
- Clicar num produto cria `quote_items` com:
  - `quote_id`, `product_id`, `category_id` da categoria do produto, `item_type` derivado da categoria (mapeia `flight/hotel/transport/...` via `category-schema`; senão `other_service`), `title = product.name`, `unit_price = product.sale_price ?? 0`, `unit_cost = product.cost ?? 0`, `quantity = 1`, `details = {}`, `sort_order = max+1`.
  - Em seguida, fecha o modal e navega para `/quotes/:quoteId/items/:itemId`.

### 4. `src/pages/QuoteItemEdit.tsx` (novo, tela dedicada)
Rota: `/quotes/:quoteId/items/:itemId`. Botão **Voltar** leva a `/quotes/:quoteId?tab=modular`.

Seções:
1. **Cabeçalho** — categoria + produto vinculado (com link para trocar/desvincular) + botão Excluir.
2. **Campos dinâmicos da categoria** — `<DynamicCategoryFields schema={category.field_schema} value={item.details} onChange={...} />`. Persiste em `quote_items.details`. Campos com `mapsTo` também atualizam a coluna estruturada correspondente (ex.: `checkin_data → utilization_start`).
3. **Comercial** — reusa `<QuoteItemCommercialFields />`.
4. **Anexos / link externo** — reusa `<QuoteItemAttachmentsV2 />`.
5. **Reserva** — reusa `<QuoteItemReservationFields />` quando o tipo derivado tiver config.

Autosave debounce 600ms + botão Salvar manual; toast no sucesso.

### 5. `src/components/quotes/DynamicCategoryFields.tsx` (novo)
Renderiza um `field_schema` em grid de 12 colunas respeitando `width` e `group`. Tipos:
- `text`, `textarea`, `number`, `date`, `time`, `select`, `checkbox`, `currency` → inputs nativos do design system.
- Especiais: `airport`, `airline`, `google_places`, `baggage`, `duration_auto` → componentes próprios reusando lógica já existente em `Quotes.tsx` (extraída em helpers compartilhados).
- Campos com `mapsTo` espelham o valor na coluna estruturada do item ao salvar.

### 6. Rota
- `src/App.tsx`: adicionar `<Route path="/quotes/:quoteId/items/:itemId" element={<ProtectedRoute><AppLayout><QuoteItemEdit/></AppLayout></ProtectedRoute>} />`.

## O que NÃO muda nesta fase
- Abas Voo/Hotel/Transporte/etc. e seus formulários continuam funcionando exatamente como hoje.
- `accept-quote`, snapshots, triggers de pós-venda, PDF público, WhatsApp summary — sem impacto (lêem os mesmos campos de `quote_items`).
- Schema do banco: `product_categories.field_schema` e `quote_items.product_id/category_id/details` já existem. **Sem migration nesta fase.**

## Detalhes técnicos

```text
Quotes.tsx
 └── Tabs
     ├── Principal
     ├── Itens (novo) ── QuoteModularItemsList
     │                    ├─ + Adicionar item → ProductSearchDialog
     │                    │     ├─ Busca global
     │                    │     ├─ + Novo produto (cadastro rápido)
     │                    │     └─ Resultados agrupados por categoria
     │                    └─ row click → /quotes/:id/items/:itemId
     ├── Voo / Hotel / Transporte / ... (intactas)
     ├── Roteiro
     └── ...

QuoteItemEdit (página dedicada)
 ├── Header (categoria, produto, Excluir)
 ├── DynamicCategoryFields(schema, details)
 ├── QuoteItemCommercialFields
 ├── QuoteItemAttachmentsV2
 └── QuoteItemReservationFields
```

Mapeamento `category → item_type` em `src/lib/category-schema.ts`: constante por categoria seed (Voo→flight, Hospedagem→hotel, Locação→transport) e fallback `other_service` para categorias customizadas.

## Critérios de aceitação
1. Aba **Itens** abre, **+ Adicionar item** mostra modal com busca + grupos por categoria + atalho **+ Novo produto** funcionando.
2. Criar item de Voo direto pela busca leva à tela dedicada já com os campos do template Voo.
3. Editar campos da categoria persiste em `details`; `mapsTo` atualiza as colunas estruturadas (visível na aba Voo antiga).
4. Excluir item volta para `/quotes/:id?tab=modular` sem o item.
5. Abas fixas, PDF público e WhatsApp summary sem regressão.

## Fora de escopo (Fase 3)
- Migrar itens criados pelas abas fixas para o modelo modular.
- Esconder/desligar as abas fixas.
- Duplicar item, transformar em opção (reaproveitar `QuoteOptionsManager` depois).
