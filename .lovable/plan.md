## Plano completo — Financeiro (menu + Contas a Pagar/Receber)

Dois blocos independentes que serão entregues juntos.

---

# Bloco A — Reorganização do menu Financeiro

### Arquivo: `src/components/AppSidebar.tsx` (e `src/lib/permissions.ts`)

1. **"Financeiro" deixa de ser link.** Vira apenas um cabeçalho de grupo expansível/recolhível (chevron). Clicar não navega — só abre/fecha o submenu. Estado persistido em `localStorage` e auto-aberto quando a rota atual está dentro de `/finance/*`.

2. **Nova ordem do submenu Financeiro:**
   1. **Dashboard Financeiro** *(renomeado de "Relatórios")* → `/finance/reports`
   2. **Extrato** *(novo item)* → `/finance` (tela que hoje abre ao clicar em "Financeiro")
   3. **Contas a Pagar** → `/finance/payables`
   4. **Contas a Receber** → `/finance/receivables`
   5. **Vendas Fechadas** → `/finance/closed-sales` *(ver Bloco A.3)*
   6. **Cadastros Financeiros** → `/finance/registrations`

3. **"Vendas Fechadas" — manter as duas telas, com papéis distintos:**

   | Tela | Caminho | Foco | Quem usa |
   |---|---|---|---|
   | CRM → Vendas | `/sales` (kanban) | Pipeline operacional: cotações em negociação até ganhar/perder | Comercial |
   | Financeiro → Vendas Fechadas | `/finance/closed-sales` | Lista contábil somente de vendas com status `won`, com colunas financeiras (valor, comissão, fatura, recebido, margem) e filtros por período | Financeiro |

   **Justificativa:** mesma fonte (`quotes`), mas recortes diferentes — uma é fluxo de trabalho (kanban), a outra é visão de receita realizada para conciliação. Remover qualquer uma força um perfil a usar a tela do outro.

   **Ação:** sem mudança de código nas telas; apenas mantemos os dois itens nos menus corretos (CRM e Financeiro).

4. **`src/lib/permissions.ts`:** renomear o label `"Relatórios Financeiros"` para `"Dashboard Financeiro"` e adicionar entrada para `/finance` rotulada como `"Extrato"` (mesma allowedRoles do grupo financeiro).

---

# Bloco B — Contas a Pagar/Receber: lançamentos não aparecem + seletor de período ampliado

### Diagnóstico (causa do "vazio em Outubro/2025")

Inspecionei `financial_transactions`: existem 18 registros com `type='expense'` e 1 com `type='receivable'`. **Dois bugs** em `PayablesReceivables.tsx`:

- **Bug 1:** filtra por `t.type === 'payable'`, mas o banco usa `'expense'`. Nenhum bate.
- **Bug 2:** descarta lançamentos sem `due_date`. 16 dos 19 não têm `due_date` — só aparecem 3 (todos em 2026), então Outubro/2025 fica vazio.

### Arquivo: `src/pages/PayablesReceivables.tsx`

1. **Mapeamento de tipos:**
   - `mode='payable'` aceita `type IN ('payable','expense')`
   - `mode='receivable'` aceita `type IN ('receivable','income')`
   - `mode='all'` aceita todos

2. **Fallback de data:** usar `due_date ?? date` como "data efetiva" em filtro de período, cards de resumo, ordenação e coluna "Vencimento" (com marcador sutil "(lançamento)" quando vier do fallback).

3. **Seletor de período ampliado** — substituir a navegação `← Mês →` por:
   - **Presets:** Hoje · Ontem · Esta semana · Semana passada · Últimos 7 dias · Últimos 30 dias · Este mês *(padrão)* · Mês passado · Este trimestre · Este ano · Ano passado · Todo período · **Personalizado…**
   - **Personalizado:** popover com `Calendar mode="range"` (dois calendários, formato `dd/MM/yyyy`).
   - Chip exibindo o range aplicado + botão "Limpar".
   - Escolha persistida em `localStorage` por modo (`payables` / `receivables` / `all`).
   - Cards de resumo (Vencidos/Hoje/A vencer/Pagos/Total) refletem o range.
   - Cálculo via `date-fns` (`startOfWeek`, `startOfMonth`, `startOfQuarter`, `startOfYear`, `subDays`).

### Verificação esperada

Em **Contas a Pagar** filtrando **Outubro/2025** devem aparecer pelo menos: Domínio altivusturismo.com.br (R$ 76,00 · 21/10), Taxa JUCERJA (R$ 600,00 · 20/10), Taxa Alvará (R$ 1.218,10 · 21/10).

---

## Arquivos tocados (resumo)

- `src/components/AppSidebar.tsx` — grupo Financeiro não-clicável, nova ordem, item "Extrato", rename "Relatórios" → "Dashboard Financeiro".
- `src/lib/permissions.ts` — label + entrada "/finance" como "Extrato".
- `src/pages/PayablesReceivables.tsx` — fix de tipos, fallback de data, seletor de período.

Sem alterações de schema de banco. Sem mudança nas rotas em `App.tsx`.