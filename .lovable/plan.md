
# Plano v2 — Fluxo comercial + financeiro Altivus

Ajustes desta versão em relação ao v1:
- `lost` sai como etapa e vira **situação do card** (badge), aplicável em qualquer etapa.
- `awaiting_travel` movido para o bloco **Pós-venda**.
- Todo item da cotação/venda **precisa estar no catálogo** (com validação anti-duplicidade); todo produto do catálogo **precisa ter fornecedor** (cadastro rápido inline).
- Ciclos de faturamento: **quinzenal** = 1–15 e 16–fim; **mensal** = dia 1 ao último dia.
- Item contestado ao sair da contestação **vai para a próxima fatura**; alternativamente pode ser **cancelado com justificativa**.
- Card do negócio ganha **coluna lateral direita** igual à de tarefas (Interações + Tarefas + Histórico). Tarefas criadas no card do negócio ficam vinculadas ao negócio; renomeia "Cotação Vinculada" → **"Negócio Vinculado"** no card de tarefas.
- Nova exigência: **histórico completo de movimentações** entre etapas para medir tempo/etapa mesmo com retrocessos.
- **Contestação vive só no Financeiro** (`/finance/billing` → detalhe da fatura). O card comercial exibe apenas aviso somente-leitura ("Item X contestado na fatura #N") na aba Financeiro. Situação `contested` **sai** da lista de badges do card.
- **Multi-serviços na mesma viagem** vira nova **Fase 7 (Viagens)**: entidade `trips` agrupa vários deals do mesmo cliente/datas; cada card mantém ciclo próprio. Não bloqueia as fases 1–6.

---

## Fase 1 — Fluxo linear único, retrocesso e histórico de movimentações

**Etapas canônicas (enum `deal_stage`):**

```text
Cotação             Emissão                     Pós-venda
────────            ─────────                   ─────────
 new                awaiting_payment            awaiting_travel
 sent               payment_received            traveling
 negotiation        issuing (fornecedor)        returned
 accepted     →     issued                      closed
                    proof_sent
```

**Situações (paralelas à etapa, badge no card):** `lost`, `paused`, `on_hold_client`, `returned_flag`. Uma delas pode conviver com qualquer etapa (ex.: card em `negotiation` marcado como `lost` fica no Kanban riscado até ser arquivado). `contested` **NÃO** é situação do card — vive só na linha da fatura (ver Fase 4).

**Retrocesso:** menu "Reabrir etapa" volta ao anterior; se a etapa reaberta já gerou lançamentos financeiros, o sistema pergunta: manter / cancelar / marcar para estorno. Nunca apaga silenciosamente.

**Histórico de movimentações — como medir tempo com retornos:**

Nova tabela `deal_stage_history`:

```text
id | deal_id | stage | entered_at | exited_at | moved_by | reason | from_stage
```

Regras:
- Cada entrada em uma etapa cria uma nova linha (`exited_at = null`).
- Ao mover, a linha aberta recebe `exited_at = now()` e uma nova é criada para a próxima etapa.
- Se o card volta a uma etapa que já esteve, **abre uma nova linha** (não reabre a antiga). Isso mantém histórico limpo.

Métricas derivadas (view `deal_stage_metrics`):
- **Tempo total na etapa X** = soma de `(exited_at − entered_at)` de todas as linhas de X para aquele deal.
- **Passagens** = contagem de linhas por etapa (>1 sinaliza retrabalho).
- **Última entrada / última saída** = MAX/último registro.
- **Idade atual na etapa** = `now() − entered_at` da linha aberta.

Trigger `on_deals_stage_change` mantém a tabela em consistência. Se um deal é arquivado, a linha aberta ganha `exited_at`.

Backfill inicial: cria uma linha para cada deal existente usando `created_at` como `entered_at` da etapa atual.

**UI:**
- Kanban único em `/crm/ops` com 3 zonas visuais (Cotação | Emissão | Pós-venda) separadas por divisórias, drag entre zonas.
- `/sales` vira uma visão filtrada (Emissão + Pós-venda).
- Nova tela `/crm/reports/pipeline` com tempo médio por etapa, retrabalho, gargalos.

---

## Fase 2 — Catálogo obrigatório + fornecedor obrigatório

**Regras duras:**
1. Todo `quote_items` deve ter `product_id` preenchido. Salvar item sem produto do catálogo é bloqueado.
2. Todo `products` deve ter `supplier_id` preenchido (adiciona `NOT NULL` após backfill).
3. Fornecedores vêm do `suppliers` existente.

**Fluxo de inclusão no card do item da cotação:**
- Campo de busca no catálogo (autocomplete). Selecionou → item preenchido.
- Se não encontrou → botão **"Cadastrar no catálogo"** abre modal inline com:
  - Nome, categoria, descrição, custo, preço, **fornecedor** (com sub-botão "Cadastrar fornecedor" se não existir).
  - **Validação anti-duplicidade**: ao digitar o nome, o sistema busca em `products` por similaridade (trigram/`pg_trgm` no nome + categoria) e exibe "Já existe um produto parecido: X — usar este?". Impede criar duplicata sem confirmação explícita.

**Sincronização (snapshot com atualização manual):** snapshot do preço/descrição no `quote_items` no momento da inclusão. Se o catálogo mudar depois, aparece selo "Catálogo atualizado — revisar" com botão para trazer os novos valores.

Migração inclui:
- Backfill de `product_id` para itens antigos (matcher por título; itens sem match ficam num relatório de higienização com botão "Vincular a produto existente ou criar novo").
- `NOT NULL` só é aplicado depois do backfill 100%.

---

## Fase 3 — Emissão gera AR/AP automaticamente

Ao passar de `accepted` para `awaiting_payment`, abre **wizard de Emissão** obrigatório:

1. **Recebimento do cliente**: forma (à vista, cartão N vezes, boleto, **faturado** — só se cliente tem contrato ativo, ver Fase 4), conta bancária de destino, vencimento.
2. **Pagamento aos fornecedores**: um bloco por `supplier_id` distinto (agora garantido pela Fase 2), valor consolidado, forma e vencimento.
3. **Comissão do agente**: usa `quote_items.commission_amount` existente; gera AP para o agente conforme regra do contrato.

Ao confirmar, cria `financial_transactions`:
- N `receivable` para o cliente (parcelas via `installment_*` que já existe).
- 1 `payable` por fornecedor.
- 1 `payable` de comissão por agente (opcional).

Vínculo via `quote_id` (existente) + novo `sale_id` (novo campo em `financial_transactions`).

**Comprovantes ao cliente:** nova aba "Comprovantes" no card do negócio com upload dos vouchers/bilhetes + botão "Enviar por email" (template `sale-vouchers`) com registro em `email_send_log`.

---

## Fase 4 — Faturamento contratual (cliente faturado)

**Novas tabelas:**

- `billing_contracts`: `client_id`, `frequency` (`daily|weekly|biweekly|monthly`), `email_recipients[]`, `due_days_after_close`, `auto_send`, `active`.
- `billing_invoices`: `contract_id`, `client_id`, `period_start`, `period_end`, `status` (`draft|sent|partially_paid|paid|overdue`), `total_amount`, `paid_amount`, `pdf_url`, `boleto_url`, `sent_at`, `due_date`.
- `billing_invoice_items`: liga `billing_invoice_id` a cada `financial_transactions` (receivable) do período; status próprio (`included|contested|deferred|paid|cancelled`), `contest_reason`, `cancel_reason`.

**Ciclos (fechados por cron diário `close-billing-cycles`):**
- **Diário:** cada dia útil fecha o dia anterior.
- **Semanal:** seg–dom; fecha na segunda de manhã.
- **Quinzenal:** dia 1–15 (fecha dia 16) e dia 16–fim do mês (fecha dia 1 do mês seguinte).
- **Mensal:** dia 1 ao último dia do mês (fecha dia 1 do mês seguinte).

**Fluxo da fatura:**
1. Cron gera `billing_invoice` `draft` com PDF do extrato detalhado.
2. Operador revisa (ou `auto_send=true` envia direto). Ao enviar, dispara email com PDF + link do portal + boleto (placeholder — upload manual até definirmos gateway).
3. Baixa proporcional: quando `Σ itens paid = total − cancelled − contested`, fatura vira `paid`. Faltando algo, vira `partially_paid`.

**Contestação e cancelamento de itens:**
- Marcar item como `contested` (com razão) exclui-o do valor cobrável da fatura atual.
- Sair da contestação (operador clica "Resolver contestação") → o item **entra automaticamente na próxima fatura** do mesmo contrato (a linha do `financial_transaction` fica `pending` de novo e será varrida no próximo ciclo).
- Alternativa: **cancelar item** (com `cancel_reason` obrigatório) → `financial_transaction` vira `cancelled`, some das próximas faturas, fica auditável.

**Tela `/finance/billing`:**
- Aba **Contratos** (CRUD).
- Aba **Faturas** (Kanban Rascunho → Enviada → Parcialmente paga → Paga / Vencida).
- Detalhe da fatura mostra timeline de eventos (envio, aberturas, etc. — ver Fase 5) + gestor de contestação/cancelamento por item.

---

## Fase 5 — Envio de email + tracking

- Provedor externo (Resend / SendGrid / Brevo — confirmar após aprovar o plano) só para faturas. Lovable Emails continua para auth/sistema.
- Nova tabela `email_events`: `email_send_log_id`, `event_type` (`delivered|opened|clicked|bounced|complained|replied_manual`), `occurred_at`, `metadata`.
- Edge Function `email-tracking-webhook` recebe eventos do provedor.
- Resposta do cliente = marcação manual pelo operador (IMAP fica para futuro).
- UI: timeline na fatura + badge "Não aberto há X dias" na lista + follow-up automático opcional (cria task no CRM).

---

## Fase 6 — Card do negócio com estrutura de tarefa

Espelha exatamente o layout da tela de Tarefa (`/tasks/:id`) referenciada na imagem enviada.

**Layout do card do negócio (drawer/página):**
- **Coluna esquerda**: dados do negócio (título, responsável, importância, prazo, status/etapa, cliente vinculado, descrição rica, itens da cesta, comprovantes, etc.).
- **Coluna direita** (nova, idêntica à de tarefas):
  - **Interações** — adicionar nota (Ctrl+Enter para enviar).
  - **Tarefas** (no lugar de "Lembretes") — botão "+ Adicionar" cria uma `task` já com `deal_id` preenchido.
  - **Histórico** — abas Tudo / Notas / Atividades / **Movimentações** (esta última puxa de `deal_stage_history`, mostrando cada entrada/saída de etapa com tempo decorrido).

**Sincronização Tarefa ↔ Negócio:**
- Nova coluna `tasks.deal_id` (FK para `deals`). Backfill vazio (opcional).
- Tarefa criada dentro do card do negócio nasce com `deal_id` setado.
- Na tela de detalhe da tarefa (`/tasks/:id`), o campo hoje chamado **"Cotação Vinculada"** vira **"Negócio Vinculado"** e passa a apontar para `deals` (não mais `quotes`). Migração de dados: onde a tarefa aponta hoje para uma `quote`, resolve o `deal` correspondente e migra o valor. Se não houver deal, mantém a quote (compatibilidade transitória).
- Atualização de qualquer lado (criar/editar/excluir tarefa) é refletida no outro em tempo real (Realtime já usado no projeto).

---

## Detalhes técnicos consolidados

**Migrações (ordem, todas com GRANT + RLS):**

1. Nova enum `deal_stage` com todas as etapas + coluna `situation` (array de badges) em `deals`.
2. Tabela `deal_stage_history` + trigger `on_deals_stage_change`.
3. `products.supplier_id NOT NULL` após backfill; índice `pg_trgm` em `products.name` para anti-duplicidade.
4. `quote_items.product_id NOT NULL` após backfill.
5. `financial_transactions.sale_id` + `cancelled_reason`.
6. `tasks.deal_id` FK.
7. Tabelas `billing_contracts`, `billing_invoices`, `billing_invoice_items`, `email_events`.
8. View `deal_stage_metrics`.

**Novas Edge Functions:**
- `create-sale-financials` (chamada pelo wizard).
- `close-billing-cycles` (cron diário).
- `send-billing-invoice`.
- `email-tracking-webhook`.

**Arquivos com impacto principal:**
- `src/pages/CRM.tsx`, `src/pages/Sales.tsx`, `src/pages/TaskDetail.tsx`, `src/components/crm/LeadDetailPanel.tsx` (ou o card de negócio equivalente), `src/pages/PayablesReceivables.tsx`, `src/components/AppSidebar.tsx`, `src/lib/quote-status.ts`, `src/lib/item-types.ts`.

---

## Fora deste plano

- Integração real com gateway de boleto (aguarda escolha).
- IMAP para detectar respostas reais.
- Portal externo do cliente faturado (por ora, PDF + link autenticado por token).
- OFX/CSV na conciliação (mantém como estava).

---

## Ordem sugerida de execução

1. **Fase 1** (fluxo + histórico) — fundação.
2. **Fase 6** (card de negócio como tarefa) — melhora UX imediata, independente das demais.
3. **Fase 2** (catálogo/fornecedor obrigatórios) — pode ir em paralelo.
4. **Fase 3** (emissão → AR/AP).
5. **Fase 4** (faturamento contratual).
6. **Fase 5** (email tracking).

Aprovando, começo pela Fase 1 e sigo entregando fase por fase para você validar cada uma.
