# Catálogo tipado — motor TIPO_SCHEMA (v1: Voo + Hospedagem)

## Estratégia

Reaproveitar a infraestrutura que já existe (`src/lib/category-schema.ts` + `DynamicCategoryFields`) em vez de criar um motor paralelo. Hoje o schema é por **categoria** (linha em `product_categories`); vamos transformá-lo em schema por **TIPO** (constante em código), e Categoria vira um **campo select** dentro do schema do tipo. Nada novo no banco — tudo continua em `products.attributes` (jsonb) e `quote_items.details` (jsonb).

## 1. Nova fonte única de verdade: `src/lib/type-schema.ts`

Objeto `TIPO_SCHEMA: Record<TypeKey, TypeSchemaDef>` onde cada campo estende o `CategoryField` atual com:

- `scope: "template" | "instancia"` (default `"template"`)
- Tipos de input reaproveitados do enum existente: `text | textarea | number | currency | date | time | select | checkbox | airport | airline | google_places | baggage | duration_auto`
- O campo `categoria` é sempre um `select` `scope: "template"` cujas `options` são as categorias válidas daquele tipo

### v1 — dois tipos populados

**voo** (categoria: Nacional, Internacional, Fretado)
- Template: `categoria`, `companhia` (airline, required), `classe` (select), `origem` (airport, required), `destino` (airport, required), `conexao` (select), `bagagem_mao` (number), `bagagem_despachada` (number)
- Instância: `data_embarque` (date), `horario_embarque` (time), `data_chegada` (date), `horario_chegada` (time), `numero_voo` (text), `localizador` (text), `numero_compra` (text)

**hospedagem** (categoria: Hotel, Resort, Pousada, Apart-hotel, Villa)
- Template: `categoria`, `localizacao` (text required), `estrelas` (select 1–5), `tipo_acomodacao` (text), `regime` (select), `comodidades` (checkbox multi)
- Instância: `check_in` (date), `check_out` (date), `num_noites` (number), `num_quartos` (number), `num_hospedes` (number)

Helpers exportados: `getTypeSchema(type)`, `getTemplateFields(type)`, `getInstanceFields(type)`, `getCategoryOptions(type)`, `isValidCategoryForType(type, cat)`.

## 2. Adaptar o renderer

`src/components/quotes/DynamicCategoryFields.tsx` ganha prop opcional `scopeFilter?: "template" | "all"` (default `all`). Filtra `schema` antes de agrupar. Tipos `airport`/`airline`/`baggage` já são suportados — sem mudança visual.

## 3. Form do catálogo (`src/pages/CatalogEdit.tsx`)

- Adicionar `voo` em `TYPE_OPTIONS` (com label "Voo").
- Remover do `Catalog.tsx` o aviso "Voos não entram no catálogo" (subtítulo).
- Substituir o bloco `typeAttributesUI` (switch hard-coded) e o select de Categoria global por **uma única seção "Detalhes do {Tipo}"** que renderiza `<DynamicCategoryFields schema={getTemplateFields(form.item_type)} value={form.attributes} onChange={...} scopeFilter="template" />`.
- Categoria deixa de ler `product_categories`; passa a ser o campo `categoria` dentro de `attributes`. Manter `category_id` no payload como `null` (não removemos a coluna, mas paramos de usá-la para tipos com TIPO_SCHEMA).
- Ao trocar `item_type`, **resetar `attributes`** (descarta categoria/atributos antigos para evitar combinação inválida).
- Validação: além de Nome+Tipo, validar `required` dos campos template e `isValidCategoryForType`.

## 4. Item da cotação

Onde hoje renderizamos `DynamicCategoryFields` a partir de `product_categories.field_schema`, passar a usar `getTypeSchema(item.item_type)` quando o tipo tiver entrada em `TIPO_SCHEMA` (Voo e Hospedagem nesta v1). Fallback ao schema antigo para tipos ainda não migrados — não quebra cotações existentes.

Render no item = `schema completo` (template + instancia), sem `scopeFilter`. Mantém edição livre de qualquer campo.

### "Puxar do catálogo" (`QuoteItemProductPicker.tsx` + `pick`)

Estender o callback `onSelect` para receber também `attributes` do produto. No handler do item:

```
unit_cost / unit_price ← cost / sale_price do produto (como hoje)
details ← { ...details, ...produto.attributes }   // só template, instancia fica vazia
product_id ← produto.id
```

Snapshot por cópia: edição posterior do produto não afeta a cotação (já é o comportamento, só precisamos garantir que **não** lemos `products.attributes` na hora de renderizar — sempre lemos `quote_items.details`).

Remover aviso "produto não cadastrado" quando `product_id` existir (já existe a checagem; só validar).

## 5. Permissões

Custo-base (`cost`) continua escondido para non-admin/manager (`canSeeCost` já existe em `CatalogEdit` e nos itens da cotação via `QuoteItemCommercialFields`). Nenhuma mudança.

## 6. Migração de dados — nenhuma

`products.attributes`, `products.item_type`, `quote_items.details` já existem. Produtos antigos sem `attributes.categoria` continuam funcionando (campo vazio). Cotações antigas continuam usando o schema por categoria via fallback.

## Critérios de aceite (mapeados)

1. Troca de Tipo no form → re-render da seção Detalhes + reset de Categoria (via reset de `attributes`). ✓
2. Tentar salvar Hospedagem com categoria de Transporte é impossível: as opções vêm do próprio schema do tipo. ✓
3. Voo GOL GIG→SCL Executiva: cadastra → puxa no item → companhia/classe/aeroportos/bagagem preenchidos; data/hora/localizador vazios (são `scope:"instancia"`, não copiados). ✓
4. Snapshot via cópia em `quote_items.details`. ✓
5. Itens sem `product_id` continuam editáveis manualmente como hoje. ✓
6. `canSeeCost` controla visibilidade do custo. ✓

## Arquivos tocados

- **novo** `src/lib/type-schema.ts` — TIPO_SCHEMA + helpers
- `src/components/quotes/DynamicCategoryFields.tsx` — prop `scopeFilter`
- `src/pages/CatalogEdit.tsx` — adicionar "voo" no TYPE_OPTIONS, trocar `typeAttributesUI` e Categoria por `DynamicCategoryFields` com schema do tipo, reset ao trocar tipo
- `src/pages/Catalog.tsx` — remover aviso "Voos não entram no catálogo"
- `src/components/quotes/QuoteItemProductPicker.tsx` — incluir `attributes` no `onSelect`
- Local onde o item de cotação chama `DynamicCategoryFields` (ex.: `QuoteItemEdit.tsx` / `QuoteModularItemsList.tsx`) — passar a usar `getTypeSchema` quando disponível, com fallback ao schema da categoria
- Handler que recebe `onSelect` do picker — fazer merge de `attributes` em `details`

## Fora de escopo (confirmado)

- Tipos seguro, transporte, experiência, cruzeiro, outro (entram só adicionando entradas no TIPO_SCHEMA depois).
- Pacotes.
- Preço por temporada/fornecedor.