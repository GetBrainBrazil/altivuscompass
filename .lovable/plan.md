# Voltar inteligente do editor de cotações + integração 2 vias confirmada

## Problema
Hoje, ao clicar na seta "voltar" dentro do editor de cotações, o usuário sempre cai no pipeline `/quotes`, mesmo quando abriu a cotação a partir do card do lead no CRM. Deveria voltar para o lead de origem.

## Sobre a "integração 2 vias" do pipeline
**Já está funcionando.** Toda cotação criada a partir do card do lead salva `lead_id` na tabela `quotes` (Quotes.tsx:817) e dispara `invalidateQueries(["quotes"])` (linhas 968, 1018, 1034…). Resultado: a nova cotação **já aparece automaticamente** no pipeline `/quotes` e segue vinculada ao lead. Nenhuma mudança extra é necessária aqui — vou apenas confirmar isso visualmente para o usuário ao final.

## Solução do "voltar" — origem persistida em `sessionStorage`

Padrão simples, robusto contra refresh, sem precisar refatorar a navegação:

### 1. `src/pages/LeadDetail.tsx` — gravar origem antes de navegar
Sempre que o lead navegar para o editor (clique em card de cotação OU botão "Nova Cotação"), gravar:
```ts
sessionStorage.setItem("quotes:returnTo", `/crm/lead/${id}${location.search}`);
```
Pontos a alterar: os 3 locais que já existem na aba/header (clique no `QuoteKanbanCard`, botão "Nova Cotação" do header e do empty state).

### 2. `src/pages/Quotes.tsx` — consumir e limpar origem ao fechar
No `performCloseDialog` (linha ~1440), após o reset normal do estado, ler `sessionStorage.getItem("quotes:returnTo")`:
- Se existir: remover a chave e `navigate(returnTo)` — volta para o lead.
- Se não existir: comportamento atual (fica em `/quotes`).

Isso cobre tanto o botão de voltar (seta) quanto o "Cancelar" e o auto-fechamento após salvar com sucesso (que também passa por `performCloseDialog`).

### 3. Edge case — abandono da chave
A chave fica em `sessionStorage` (some quando a aba é fechada) e é deletada assim que consumida. Para evitar consumo indevido se o usuário abrir o editor por outro caminho (ex.: clicar num card direto no `/quotes`), gravo também um carimbo de tempo e expiração curta:
- Chave: `quotes:returnTo` com valor `{ url, ts }` (JSON).
- Consumir só se `Date.now() - ts < 5 * 60_000` (5 min).
- Caso contrário, descartar.

## Detalhes técnicos
- Arquivos editados:
  - `src/pages/LeadDetail.tsx` — 3 pontos de navegação setam `sessionStorage`.
  - `src/pages/Quotes.tsx` — `performCloseDialog` lê e roteia.
- Sem mudanças de banco, sem novas dependências, sem novas rotas.

## Fora de escopo
- Refator do editor para componente isolado embutido no LeadDetail (já discutido antes como evolução futura).
