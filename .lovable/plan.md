## Objetivo

Permitir lançar Contas a Pagar, Contas a Receber e lançamentos manuais do Extrato escolhendo **Cliente OU Fornecedor** (e demais partes já existentes em `financial_parties`) na mesma seleção, sem unificar as tabelas `clients` e `suppliers`.

Resolve o caso concreto: estorno recebido de um fornecedor pode ser lançado em Contas a Receber apontando para o fornecedor como contraparte.

## Por que não unificar as tabelas (decisão registrada)

`clients` carrega dados sensíveis de viajante (passaporte, visto, passageiros, anexos, interações de CRM) e tem público de acesso diferente de `suppliers` (contratos, comissões, compras). Unificar exigiria RLS por coluna e migração com risco alto sobre FKs financeiras. O problema real é só de UI no seletor — vamos resolver ali.

## Mudanças

### 1. Novo componente `CounterpartySelect`

`src/components/finance/CounterpartySelect.tsx` — Combobox único que lista, com agrupamento e busca:

- **Clientes** (de `clients`, ativos)
- **Fornecedores** (de `suppliers`, ativos)
- **Outras partes** (de `financial_parties` — sócios, governo, funcionários etc.)
- Atalhos no topo: "+ Cadastrar novo cliente", "+ Cadastrar novo fornecedor"

Props: `value: { kind: 'client'|'supplier'|'party'|null; id: string|null; name: string|null }`, `onChange`, `allowedKinds?` (default todos), `label`, `placeholder`.

Cada item exibe um chip discreto à direita indicando o tipo (Cliente / Fornecedor / Outro) para o usuário não confundir homônimos. Busca por nome, nome fantasia e documento.

### 2. `PayableReceivableForm` — usar o seletor único

`src/pages/PayableReceivableForm.tsx`:

- Substituir os dois `Select` separados (linhas ~305–331) por um único `CounterpartySelect`.
- Label dinâmica: "Contraparte" (Cliente, Fornecedor ou outro).
- Ao salvar, gravar `client_id` **ou** `supplier_id` conforme o tipo escolhido, e sempre preencher `party_name` com o rótulo legível. Se for "Outra parte", gravar só `party_name` (mesma coluna textual que já existe).
- Remover a restrição implícita atual ("Receivable só mostra clientes / Payable só mostra fornecedores"). Por padrão todos os tipos ficam disponíveis em ambos os modos, mas o tipo "natural" do modo aparece pré-expandido no topo da lista (Clientes primeiro em Receivable; Fornecedores primeiro em Payable).

### 3. Extrato (`Finance.tsx`) — mesmo seletor

Substituir o Popover atual (linhas ~387–420) pelo `CounterpartySelect`. Comportamento idêntico ao do form de AP/AR; grava `client_id`/`supplier_id` quando aplicável (hoje só grava `party_name`).

### 4. Listagens — mostrar o tipo da contraparte

`PayablesReceivables.tsx` e `Finance.tsx`:

- Na coluna de contraparte, adicionar chip pequeno "Cliente" / "Fornecedor" / "Outro" ao lado do nome quando o lançamento tem `client_id` ou `supplier_id` (ou nenhum dos dois).
- Atualizar o cabeçalho da coluna em AP/AR para "Contraparte" em vez de "Cliente"/"Fornecedor" (continua filtrável pela busca atual).

### 5. Filtro opcional na listagem

Adicionar em `PayablesReceivables.tsx` um filtro "Tipo de contraparte" (Todos / Cliente / Fornecedor / Outro) ao lado dos filtros existentes, para não poluir mas dar como sair de cenários como "quero ver só recebimentos de fornecedores".

## Fora de escopo

- Unificar `clients` + `suppliers` no banco.
- Migrar lançamentos antigos para preencher `client_id`/`supplier_id` retroativamente (mantemos `party_name` como fallback de leitura).
- Mudanças de RLS (as policies atuais de `clients`, `suppliers` e `financial_parties` continuam válidas; quem já enxergava cada tabela continua enxergando).

## Detalhes técnicos

- Queries com React Query, chaves `["counterparty-clients"]`, `["counterparty-suppliers"]`, `["counterparty-parties"]`, reaproveitadas onde já existem.
- Sem migração de schema. `financial_transactions` já tem `client_id`, `supplier_id` e `party_name`; estamos só usando melhor.
- Componente shadcn `Command` + `Popover` para o combobox agrupado, mesmo padrão do popover atual no Extrato.
- Linha de leitura em listagens usa `client_id ? 'Cliente' : supplier_id ? 'Fornecedor' : 'Outro'` para o chip.
