## Objetivo

Manter as duas telas separadas (cada time no seu ambiente), mas adicionar visibilidade cruzada quando o usuário precisar pular de uma para a outra.

## Mudanças

### 1. Vendas Fechadas (Financeiro) → link para Vendas (CRM)
Em `src/pages/FinanceClosedSales.tsx`:
- Tornar cada linha da tabela clicável, abrindo a venda operacional correspondente em `/sales?open=<sale_id>` (padrão já usado em outras telas com `?edit=` / `?open=`).
- Adicionar um ícone discreto `ExternalLink` na coluna do cliente/destino para deixar a navegação explícita.
- Tooltip "Abrir venda no CRM".

### 2. Vendas (CRM) → resumo financeiro + link para Financeiro
Em `src/pages/Sales.tsx`:
- Ao abrir uma venda (modal/drawer existente, ou inline na linha expandida — o que já houver), adicionar um card "Resumo financeiro" puxando da mesma fonte que `FinanceClosedSales` usa:
  - Receita total (sales.total_value)
  - Custo total (soma de `quote_items.unit_cost * quantity` do `quote_id`)
  - Margem (R$ e %)
  - Status de recebimento: total recebido / em aberto / vencido (a partir de `financial_transactions` filtradas por `quote_id` e `type='income'`)
- Botão no rodapé do card: "Ver em Vendas Fechadas" → `/finance/closed-sales?quote=<quote_id>` (highlight da linha ao abrir).
- Botão secundário: "Ver lançamentos" → `/finance/receivables?quote=<quote_id>`.

### 3. Highlight ao chegar via deep link
- `FinanceClosedSales.tsx`: ler `?quote=` da URL e destacar/rolar até a linha correspondente por ~2s.
- `Sales.tsx`: ler `?open=` para abrir automaticamente o detalhe da venda.

### 4. Pequeno componente reutilizável
- Criar `src/components/sales/SalesFinancialSummaryCard.tsx` (read-only) usado dentro do detalhe da venda no CRM. Recebe `quoteId` e `saleId`, faz as queries e renderiza os números + botões.

## Fora de escopo
- Renomear menus, mover páginas ou alterar permissões.
- Mudar regras de negócio de fechamento de venda ou de geração de lançamentos.
- Edição financeira a partir do CRM (continua read-only com link para o módulo financeiro).

## Detalhes técnicos
- Queries com React Query (`useQuery`), chaves `["sales-financial-summary", quoteId]`.
- Reusar formatação `fmtBRL` já existente.
- Navegação com `useNavigate` + `useSearchParams`.
- Sem alteração de schema; apenas leitura de `sales`, `quotes`, `quote_items`, `financial_transactions`.
