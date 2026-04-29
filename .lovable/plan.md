# Cotações inline na aba do Lead (integração 2 vias)

## Problema
Hoje a aba **Cotações** do `LeadDetail` só mostra um contador e botões que **redirecionam** para `/quotes?lead_id=...` ou `/quotes?new=1&lead_id=...`. Pior: `src/pages/Quotes.tsx` **não lê** esses query params (`useSearchParams` não é usado), então o redirect cai na lista geral, sem abrir nada nem aplicar filtro.

## Objetivo
Listar as cotações vinculadas ao lead **dentro da própria aba**, permitir **abrir/editar** sem sair da página, e refletir mudanças em ambos os lados (lead ↔ módulo de cotações).

## Mudanças

### 1. Buscar as cotações reais (não só count) — `src/pages/LeadDetail.tsx`
- Trocar `quotesCount` por `leadQuotes: Quote[]` carregando os campos usados no card: `id, title, destination, travel_date_start, travel_date_end, total_value, stage, conclusion_type, quote_validity, created_at, updated_at`.
- Manter `quotesCount = leadQuotes.length` para o badge da aba.
- Recarregar após fechar o editor (refetch on dialog close).

### 2. Lista visual de cotações na aba
- Renderizar uma grid de cards reutilizando o componente já existente **`QuoteKanbanCard`** (`src/components/quotes/QuoteKanbanCard.tsx`) — mesma identidade visual do kanban de Vendas.
- Cabeçalho da Section: "Cotações vinculadas (N)" + botão **"Nova Cotação"** no canto direito.
- Empty state preservado quando N=0.
- Click no card → abre o editor inline (próximo passo).

### 3. Editor inline (sem redirect) via rota com modal
Duas opções viáveis; recomendo a **Opção A** por ser mais rápida e segura:

**Opção A — Navegação para `/quotes` com auto-abertura (reuso total do editor existente)**
- Adicionar em `src/pages/Quotes.tsx` um `useSearchParams()` que:
  - Se `?edit=<quoteId>`: busca a quote, chama `setEditingQuote(q)` e `setDialogOpen(true)`.
  - Se `?new=1&lead_id=<id>`: abre o dialog em modo novo já com `form.lead_id` e `client_id` pré-preenchidos a partir do lead.
  - Após processar, limpa os params (`setSearchParams({})`) para não reabrir.
- No `LeadDetail`, click no card chama `navigate('/quotes?edit=' + id)` e o botão "Nova" chama `navigate('/quotes?new=1&lead_id=' + leadId)`.
- Vantagem: zero duplicação do editor (que tem ~3900 linhas), e a "integração 2 vias" fica natural — qualquer save no editor já persiste no mesmo `quotes`/`quote_items` que o lead lê.
- Desvantagem: ainda muda de rota. Se o usuário quer **literalmente** ficar na página do lead, ver Opção B.

**Opção B — Dialog do editor reaproveitado dentro do `LeadDetail`**
- Extrair o JSX do dialog de edição de `Quotes.tsx` (linhas ~1820+) para um componente `<QuoteEditorDialog quoteId | leadId open onOpenChange onSaved />` que encapsula todo o estado (form/items/passengers/etc.).
- Importar esse componente tanto em `Quotes.tsx` quanto em `LeadDetail.tsx`.
- Trabalho maior (refator de ~2000 linhas de estado), mas dá UX 100% inline.

**Recomendação:** começar com **Opção A** (entrega imediata, resolve o bug de "não passa o lead"). Se quiser depois evoluir para Opção B, fica em cima de uma base já correta.

### 4. Pré-preencher cliente ao criar cotação a partir do lead
Em `Quotes.tsx`, ao detectar `?new=1&lead_id=`:
- Buscar `leads.client_id, contact_id, name, phone` para popular `form.lead_id`, `form.client_id` e o display do `LeadClientPicker`.
- Garantir que ao salvar, o `lead_id` seja gravado no `quotes` (já é — linha 817).

### 5. Integração 2 vias
- Como ambos os lados leem das mesmas tabelas (`quotes`, `quote_items`), a "via" backend já existe.
- Para refletir alterações sem reload: ao fechar o dialog (callback `onSaved`/`onOpenChange(false)` voltando para `/crm/lead/...`), re-executar o fetch de `leadQuotes` no `LeadDetail`. Isso pode ser feito ouvindo `location.key` ou usando React Query (se já houver) — caso contrário, um simples `useEffect` em foco/visibilidade da aba.

## Detalhes técnicos
- Arquivos a editar:
  - `src/pages/LeadDetail.tsx` — substituir contador por lista; refatorar fetch.
  - `src/pages/Quotes.tsx` — adicionar leitura de `useSearchParams` (`edit`, `new`, `lead_id`) com efeito que dispara abertura do dialog uma única vez.
- Componentes reutilizados sem alteração: `QuoteKanbanCard`, `Section`, `EmptyState`.
- Sem migrações de banco; sem mudança de RLS.
- Sem novas dependências.

## Fora de escopo
- Refator do editor de cotações para componente isolado (Opção B) — proposto como evolução futura.
- Realtime via Supabase channels nas cotações do lead (pode ser adicionado depois).
