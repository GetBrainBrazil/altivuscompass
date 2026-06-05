## Objetivo

Marcar **cotações/vendas** e **registros financeiros** como pertencentes a **Altivus** (padrão) ou **Milhas e Voos**, para organização, filtros e relatórios separados. Cliente permanece neutro (sem vínculo a empresa).

## Modelo de dados

Criar enum `company_brand` com 2 valores: `altivus`, `milhas_e_voos`.

Adicionar coluna `company` (`company_brand`, NOT NULL, default `'altivus'`) em:
- `quotes` — define a marca da cotação/venda
- `financial_transactions` — toda receita/despesa pertence a uma empresa
- `bank_accounts` — cada conta bancária pertence a uma empresa

Backfill: todos os registros existentes ficam como `altivus`.

Nenhuma alteração em `clients`, `contacts`, `leads`.

## UI

**1. Cotações/Vendas**
- Campo "Empresa" no header do form (toggle: Altivus | Milhas e Voos), default Altivus.
- Filtro "Empresa" em `/quotes` (kanban e tabela), persistido em localStorage.
- Badge discreto "Milhas e Voos" em cards/linhas (Altivus não exibe, para reduzir ruído).

**2. Contas Bancárias** (`/finance/registrations` → aba Contas Bancárias)
- Campo "Empresa" no form de conta bancária.
- Coluna/badge "Empresa" na listagem.
- Filtro por empresa.

**3. Transações Financeiras** (Contas a Pagar/Receber e Finance)
- Campo "Empresa" no form de transação, default Altivus.
- Quando uma conta bancária é selecionada, sugere automaticamente a empresa dela (editável).
- Quando vinculada a uma cotação, herda a empresa da cotação.
- Filtro "Empresa" nas listagens de `/finance/payables-receivables` e `/finance` (cards e tabelas), persistido em localStorage.
- Badge discreto em linhas/cards.

**4. Relatórios Financeiros** (`/finance/reports`)
- Filtro "Empresa" no topo (Todas | Altivus | Milhas e Voos).
- Quando "Todas", agrupar/quebrar os totais por empresa nos KPIs e gráficos principais.

## Regras de propagação

- Cotação → quando uma venda é fechada e gera lançamento financeiro, o lançamento herda a `company` da cotação.
- Transação ↔ Conta bancária → conta bancária define a empresa por padrão; pode ser sobrescrito manualmente em casos raros (sem validação rígida agora).

## Fora de escopo (confirmado)

- ❌ Cliente NÃO recebe campo de empresa
- ❌ Logo/branding diferente no PDF e cotação pública (continua Altivus)
- ❌ Permissões/RLS por empresa (todos autenticados continuam vendo tudo)
- ❌ Cadastro dinâmico de empresas (enum fixo de 2)

## Detalhes técnicos

- Migration:
  ```sql
  CREATE TYPE public.company_brand AS ENUM ('altivus','milhas_e_voos');
  ALTER TABLE public.quotes
    ADD COLUMN company public.company_brand NOT NULL DEFAULT 'altivus';
  ALTER TABLE public.financial_transactions
    ADD COLUMN company public.company_brand NOT NULL DEFAULT 'altivus';
  ALTER TABLE public.bank_accounts
    ADD COLUMN company public.company_brand NOT NULL DEFAULT 'altivus';
  ```
- RLS inalterada — campo é só marcação organizacional.
- Após a migration, `src/integrations/supabase/types.ts` é regenerado.
- Badge usa cor accent secundária do design system (sem novas cores).
- Hook utilitário pequeno `useCompanyFilter(scopeKey)` para padronizar persistência do filtro nas várias listagens.
