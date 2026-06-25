
## Objetivo

Estruturar Contas a Pagar/Receber em **3 etapas claras** com regras consistentes:

```text
1) Lançamento/Provisão  →  2) Confirmação (Pago/Recebido)  →  3) Conciliação Bancária
   (status: pendente)        (status: pago/recebido)            (is_reconciled = true)
```

## Regras de negócio

- **Conta bancária**: opcional no lançamento, **obrigatória ao confirmar** pagamento/recebimento.
- **Comprovante**: opcional, mas se a confirmação for feita sem anexo, mostrar **badge "sem comprovante"** no item, na lista e no detalhe.
- **Conciliação**: só pode ser feita em transações já confirmadas (status pago/recebido) e que tenham `bank_account_id`. Conciliar/desconciliar é manual (uma tela dedicada por conta bancária). Importação de OFX/CSV fica para uma próxima etapa.
- **Status visuais**:
  - `pendente` (cinza) — provisão / aguardando
  - `pago` ou `recebido` (verde) — confirmado, ainda **não conciliado**
  - `pago + conciliado` (verde com selo ✓) — bate com o extrato
  - `atrasado` (vermelho) — vencido e ainda pendente
- **Reabertura**: ao "desconfirmar" um pagamento, automaticamente desconcilia. Ao excluir/editar valor ou conta de uma transação **conciliada**, exigir confirmação e desconciliar.

## Mudanças de UI

### 1. Lista de Contas a Pagar/Receber
- Nova coluna/badge de **etapa do fluxo**: Pendente · Pago · Conciliado.
- Botão de ação rápida na linha:
  - Se pendente → **"Confirmar pagamento"** / **"Confirmar recebimento"** (abre dialog).
  - Se pago/não conciliado → link **"Conciliar"** (leva até a tela de conciliação já filtrada).
- Filtro adicional: `Etapa = Todas / Pendentes / Confirmadas / Conciliadas / Sem comprovante`.

### 2. Dialog "Confirmar pagamento/recebimento"
Aberto pela ação rápida e também por um botão no formulário (quando editando):
- Data do pagamento (default = hoje)
- **Conta bancária (obrigatória)**
- Forma de pagamento
- Valor efetivo (default = valor da transação; permite ajustar e gera/atualiza juros, multa, desconto)
- Upload de comprovante (opcional, drag & drop, mesmo padrão dos anexos atuais)
- Observação

Ao salvar: atualiza `status`, `payment_date`, `bank_account_id`, `payment_method`, valores ajustados e adiciona o comprovante a `attachment_urls/notes`.

### 3. Nova tela: **Conciliação Bancária** (`/finance/reconciliation`)
- Seletor de **conta bancária** + período (default mês atual).
- Cabeçalho com **saldo do período**: confirmadas no período · conciliadas · diferença a conciliar.
- Lista de transações **confirmadas** da conta selecionada, com checkbox para marcar/desmarcar como conciliada (em lote ou individual).
- Linha mostra: data · descrição · contraparte · entrada/saída · valor · comprovante.
- Botão **"Marcar selecionadas como conciliadas"** / **"Desconciliar"**.
- Placeholder visível para a etapa futura: botão desabilitado **"Importar extrato (OFX/CSV) – em breve"**.

### 4. Sidebar (menu Financeiro)
Inserir **Conciliação Bancária** logo abaixo de **Contas a Receber**.

## Mudanças de dados

Tudo cabe em `financial_transactions` (já existem `bank_account_id`, `payment_date`, `payment_method`, `is_reconciled`, `attachment_urls/notes`). Acrescentar apenas:
- `reconciled_at` (timestamptz, nullable)
- `reconciled_by` (uuid, nullable)
- `payment_proof_indexes` (int[]) — índices em `attachment_urls` que identificam quais arquivos são comprovantes (para badge "sem comprovante" e destaque visual). Alternativa simples: marcar via prefixo na nota (`[comprovante]`). Decidir na implementação a mais leve.

Validações via **trigger** (não CHECK, por dependência de data):
- Não permitir `status='pago'/'recebido'` sem `bank_account_id` e `payment_date`.
- Não permitir `is_reconciled=true` se `status` não for confirmado.
- Ao mudar `status` de confirmado → pendente, zerar `is_reconciled`, `reconciled_at`, `reconciled_by`.

## Fora do escopo (próxima etapa)

- Importação de extrato OFX/CSV e auto-match.
- Conciliação de transferências entre contas próprias.
- Relatório de divergências por conta.

## Pergunta respondida

> Conta bancária deve ser obrigatória?

**Não no lançamento, sim na confirmação.** Isso preserva a flexibilidade para provisionar contas futuras (quando ainda não se sabe de qual conta vai sair) e garante rastreabilidade total no momento em que o dinheiro realmente entra/sai — que é o que importa para a conciliação.
