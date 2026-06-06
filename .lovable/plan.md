
## Objetivo

Tornar o CRM o centro da jornada comercial com 3 sub-itens (**Cotações → Vendas → Pós-Venda**) e mover a leitura financeira das vendas para o módulo **Financeiro** como "Vendas Fechadas". Sem mudança de banco e sem alteração funcional do Pós-Venda nesta etapa.

---

## Nova estrutura do menu lateral (ordem definitiva)

```text
Painel
Clientes

CRM
 ├─ Cotações        (/quotes)
 ├─ Vendas          (/sales — visão comercial)
 └─ Pós-Venda       (/crm?tab=ops)

Roteiros
Central de Atendimento
Campanhas
Milhas

Financeiro
 ├─ Contas a Pagar
 ├─ Contas a Receber
 ├─ Vendas Fechadas       (NOVO — visão financeira/margens)
 ├─ Cadastros Financeiros
 └─ Relatórios

Cadastros
Cofre de Senhas
```

Alterações pontuais:

- Remover do raiz: `Cotações`, `Vendas`, `Roteiros` antigo posicionamento — reordenar conforme acima.
- Remover `Funil de Vendas` de dentro do CRM (o pai "CRM" já leva ao funil em `/crm`).
- Manter rotas atuais (`/quotes`, `/sales`, `/crm`, `/crm?tab=ops`, `/crm/lead/...`) para não quebrar links, e-mails e PDFs.
- Quando o usuário estiver em `/quotes`, `/sales` ou `/crm?tab=ops`, destacar "CRM" como pai ativo + o sub-item correspondente (estender a lógica de `effectivePath`/`quotesOrigin` já existente).

---

## Vendas — Comercial vs. Financeiro

### `/sales` (continua, dentro do CRM — visão Comercial)
Sem mudanças de comportamento. Acompanhamento da venda, ajustes, trocas, cancelamentos, devoluções, inclusões. Só muda de lugar no menu.

### `/finance/closed-sales` (NOVO — visão Financeira)
Lê das vendas fechadas (`quotes` confirmadas/won), itens (custos) e `accounts_receivable` (parcelas). Apresenta:

- Tabela: cliente, valor de venda, custo total, **margem (R$ e %)**, forma de pagamento (à vista / nº de parcelas), valor recebido, em aberto, próximo vencimento.
- Filtros: período, vendedor, cliente, status de pagamento (em dia / atrasado / quitado).
- Totais no topo: receita confirmada, custo, margem média.
- Clique na linha → drawer com parcelas e itens.

Cancelamentos/devoluções continuam sendo lançados em `/sales`; aqui só refletem.

---

## Permissões

- Sub-itens herdam regras já existentes de `/quotes`, `/sales`, `/crm` em `canAccess`.
- `/finance/closed-sales` segue o mesmo perfil de `/finance/*`.

---

## Detalhes técnicos

Arquivos:

- `src/components/AppSidebar.tsx`
  - Reescrever `navItems` para a ordem acima (Painel, Clientes, CRM[Cotações/Vendas/Pós-Venda], Roteiros, Central de Atendimento, Campanhas, Milhas, Financeiro[…+Vendas Fechadas], Cadastros, Cofre de Senhas).
  - Remover entradas raiz de Cotações e Vendas.
  - Trocar `subItems` do CRM para `[Cotações → /quotes, Vendas → /sales, Pós-Venda → /crm?tab=ops]`.
  - Estender `effectivePath` para mapear `/quotes` e `/sales` ao pai "CRM" sempre (não só quando vier do CRM), e destacar o sub-item correto pelo `pathname`.
  - Adicionar `Vendas Fechadas → /finance/closed-sales` no grupo Financeiro.

- `src/App.tsx`
  - Adicionar rota `/finance/closed-sales` apontando para nova página `FinanceClosedSales`.

- `src/pages/FinanceClosedSales.tsx` (novo)
  - Tabela + filtros + totais conforme descrito, consumindo Supabase (`quotes`, itens, `accounts_receivable`).

- `src/lib/permissions.ts`
  - Garantir entrada para `/finance/closed-sales` (perfil financeiro/admin).

Sem migração de banco.

---

## Fora de escopo (próximas conversas)

- Expansão funcional do Pós-Venda (checklist de reservas, alertas D-3/D-1 de check-in, feedback pós-viagem).
- Kanban único Lead → Cotação → Venda → Pós-Venda.
- Relatórios avançados de margem por destino/fornecedor/vendedor.
