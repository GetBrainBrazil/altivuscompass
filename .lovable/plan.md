# Módulo Catálogo de Produtos — v1 (aditivo, não-destrutivo)

## Objetivo
Adicionar um catálogo de produtos reutilizáveis (hospedagem, experiência, seguro, transporte, cruzeiro, outros) que o agente pode PUXAR para dentro de uma cotação para pré-preencher os campos, em vez de digitar tudo à mão.

## Princípios inegociáveis

### 1. Não pode quebrar o fluxo atual
O fluxo de hoje (agente abre a cotação e digita o item manualmente nas abas Voos/Hospedagem/etc) continua exatamente igual. O catálogo é 100% opcional e aditivo:
- Nenhuma aba, campo ou comportamento existente da cotação é removido ou alterado.
- Se o catálogo estiver vazio, o sistema funciona idêntico a hoje.
- O caminho manual NUNCA depende do catálogo.

### 2. Snapshot, não vínculo vivo
Ao puxar um produto, o sistema COPIA custo, preço e descrição como valores editáveis no item da cotação, e guarda apenas `product_id` como rastreio.
- O agente pode sobrescrever qualquer valor.
- Editar o produto no catálogo depois NÃO altera nenhuma cotação já criada.
- Preço do catálogo é apenas SUGESTÃO de default.

## Situação atual no código (importante)

Já existe a tabela `products` (17 colunas) e o componente `src/components/quotes/QuoteItemProductPicker.tsx` que faz busca via RPC `search_products` e seleciona produto pré-preenchendo título, custo e preço. A coluna `quote_items.product_id` JÁ existe. Também existe `src/components/ProductsTab.tsx` (dentro de Cadastros) e `src/components/quotes/ProductSearchDialog.tsx`.

Ou seja: a infraestrutura básica já está pronta. Esta v1 vai **consolidar e expor o catálogo como módulo de primeira classe**, garantir snapshot puro, restringir custo por papel e padronizar o "Puxar do catálogo" em todas as abas de item.

## Banco de dados (Supabase)

### Tabela `products` — ajustes mínimos
Auditar colunas existentes e, se faltarem, adicionar (NULLABLE):
- `description` (text)
- `destination` (text)
- `category_id` (uuid, fk → product_categories)
- `tags` (text[])
- `images` (text[])
- `attributes` (jsonb default '{}') — campos específicos por tipo
- `is_active` (boolean default true) — confirmar nome
- `created_by` (uuid)

Enum de tipos suportados (`item_type`): `hotel`, `experience`, `transport`, `cruise`, `insurance`, `other_service`.
**Voo fica FORA do catálogo** (dinâmico por data/classe/tarifa).

### `quote_items.product_id`
Já existe. Nada a alterar no schema. Toda linha existente permanece com `product_id = null`. Itens manuais continuam com `product_id = null`. **Financeiro e relatórios continuam lendo custo/preço da própria linha do item** — nunca do catálogo.

### RLS — modelo de sensibilidade (igual ao de milhas/senhas)
- `admin` / `manager`: CRUD total em `products`; veem e editam `cost`.
- `sales_agent`: leitura de `products` e uso na cotação; vê `sale_price` mas **NÃO vê `cost`**.
- `operations`: somente leitura.

Implementação do bloqueio de `cost`:
- Policy de SELECT permite leitura geral, mas a coluna `cost` é mascarada via VIEW `products_safe` (sem `cost`) usada pelo papel `sales_agent` no frontend.
- Frontend nunca renderiza `cost` para `sales_agent` (gating via `useUserRole`).

## Navegação
Novo item de menu **"Catálogo"** na sidebar (ícone Package), posicionado entre "Cadastros" e "Roteiros".
- Path: `/catalog`
- Permissão: `admin`, `manager`, `sales_agent`, `operations` (leitura para operations).
- Adicionar em `src/lib/permissions.ts` e em `src/components/AppSidebar.tsx`.

A aba "Produtos" dentro de Cadastros (`ProductsTab`) permanece por compatibilidade, mas o módulo dedicado vira o caminho recomendado.

## Telas

### 1. `/catalog` — Lista de Produtos
- Grid de cards (ou tabela alternativa via toggle) com: imagem, nome, badge de tipo, preço de venda, fornecedor, status.
- Filtros: tipo, categoria, busca por nome/destino, toggle "ver inativos".
- Botão "+ Novo Produto" (admin/manager).
- Coluna/linha de **custo só renderiza para admin+manager**.
- Linha clicável abre edição (padrão do projeto).

### 2. Cadastro/Edição de Produto
Modal fullscreen em mobile, dialog em desktop. Grupos:
- **Identificação:** nome*, tipo*, descrição, destino, categoria, tags.
- **Comercial:** custo_base [gerente+], preço_venda_base, moeda (default BRL), fornecedor.
- **Mídia:** upload de imagens (bucket existente).
- **Atributos por tipo:** renderização condicional via schema simples:
  - hotel → `{ regime, estrelas }`
  - experience → `{ duracao_horas, idioma }`
  - transport → `{ veiculo, capacidade }`
  - cruise → `{ companhia, cabine }`
  - insurance → `{ cobertura, faixa_etaria }`
  - other_service → livre
- Validação: nome e tipo obrigatórios.

### 3. Integração na Cotação
Em cada aba de item suportada (Hospedagem, Experiências, Seguros, Transporte, Cruzeiro, Outros Serviços), garantir o botão **"Puxar do catálogo"** ao lado do "Adicionar item manual".
- Reuso de `QuoteItemProductPicker` / `ProductSearchDialog`, padronizando o trigger visual.
- Ao selecionar: cria item com `title`, `unit_cost`, `unit_price`, `description` (se existir) COPIADOS, e `product_id` preenchido. Todos os campos ficam editáveis.
- **Aba Voo: sem botão de catálogo.**
- Manual continua intacto.

## Arquivos afetados

**Novos:**
- `src/pages/Catalog.tsx` — lista/grid de produtos.
- `src/components/catalog/ProductFormDialog.tsx` — cadastro/edição (extrai lógica de `ProductsTab` se útil).
- `src/components/catalog/ProductTypeAttributes.tsx` — render condicional de atributos por tipo.

**Editados:**
- `src/lib/permissions.ts` — adicionar `/catalog` e feature `catalog_view_cost`.
- `src/components/AppSidebar.tsx` — novo item de menu.
- `src/App.tsx` — rota `/catalog`.
- `src/components/quotes/QuoteModularItemsList.tsx` (ou onde estão as abas) — garantir botão "Puxar do catálogo" em todas as abas elegíveis (exceto Voo).
- `src/components/quotes/QuoteItemProductPicker.tsx` — esconder `cost` para `sales_agent`.

**Migração (apenas se colunas faltarem):**
- ALTER TABLE `products` ADD COLUMN IF NOT EXISTS para `description, destination, category_id, tags, images, attributes, is_active, created_by`.
- Policies RLS revisadas para o modelo acima.
- VIEW `products_safe` sem coluna `cost` (opcional, se optarmos por mascarar no banco).

## Critérios de aceite
1. Com catálogo vazio, criar cotação e adicionar itens manualmente funciona idêntico a antes.
2. Cotações antigas abrem sem erro (`product_id = null` em todos os itens).
3. Puxar produto preenche os campos; editar depois o produto no catálogo NÃO altera a cotação já feita.
4. `sales_agent` não enxerga `cost` em nenhuma tela do catálogo nem no picker.
5. Financeiro/relatórios continuam calculando margem a partir dos valores do item da cotação, sem ler o catálogo.
6. Item "Catálogo" aparece na sidebar para todos os papéis com permissão.

## Fora de escopo (v1)
- Pacotes / produtos compostos (próximo plano).
- Preço por temporada ou por fornecedor.
- Versionamento, analytics, multimoeda avançada.
- Catalogar voos.
