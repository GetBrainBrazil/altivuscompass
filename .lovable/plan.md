## Problema
Ao clicar em uma cotação dentro do card do lead em `/crm/lead/:id`, a navegação vai para `/quotes?edit=<id>`, o que renderiza brevemente o pipeline de cotações antes de o dialog do editor abrir. Isso gera um "flash" indesejado.

## Solução
Eliminar o flash escondendo o pipeline enquanto o editor está sendo aberto a partir de uma origem externa (CRM ou outra). O usuário só vê o dialog do editor abrindo sobre um fundo neutro, sem ver o pipeline atrás.

## Mudanças

### 1. `src/pages/Quotes.tsx`
- Adicionar um estado `externalEditPending` inicializado de forma síncrona (no primeiro render) lendo `?edit=` da URL e `location.state.editQuoteId`/`newQuote`.
  - Como é inicializado no `useState(initializer)`, a página já nasce sabendo que deve esconder o pipeline — sem flash.
- No effect do `?edit=`, manter o estado `true` durante a busca da cotação.
- Em `openEdit()` (e em `openCreate()` quando vem de origem externa), virar `externalEditPending` para `false` assim que o dialog abre — neste ponto o `Dialog` já cobre a tela com o overlay do shadcn.
- No retorno principal do componente (a partir da linha ~3491), envolver o JSX do pipeline com uma checagem: se `externalEditPending && !dialogOpen`, renderizar apenas um placeholder neutro (um `<div>` com `min-h-screen bg-background`) + os Dialogs já existentes. Os dialogs continuam montados normalmente.
- Caso a busca falhe (toast de "Cotação não encontrada"), liberar `externalEditPending` para `false` para o usuário não ficar preso na tela em branco.

### 2. `src/pages/LeadDetail.tsx`
- Trocar a navegação atual `navigate(\`/quotes?edit=${q.id}\`)` por `navigate("/quotes", { state: { editQuoteId: q.id } })`.
- Isso passa o ID via `location.state` (em memória), evitando que o `?edit=` apareça na URL e que o effect dependa de `location.search`. O pipeline já nasce em modo "pending" graças ao state inicial síncrono em `Quotes.tsx`.
- Manter `setQuotesReturnTo()` antes de navegar (para o botão de voltar continuar funcionando) e a marcação de origem CRM já existente (para a sidebar continuar destacando CRM).

### 3. Suporte ao novo `state.editQuoteId` em `Quotes.tsx`
- No effect que escuta `location.state` (linha ~1245), adicionar tratamento para `state.editQuoteId`:
  - Buscar a cotação por id.
  - Chamar `openEdit(...)`.
  - Limpar o state com `navigate(location.pathname, { replace: true, state: {} })`.
  - Em caso de erro, mostrar toast e liberar `externalEditPending`.

## Resultado esperado
- Clicar no card de cotação dentro do lead abre o dialog do editor diretamente, sobre um fundo neutro — sem mostrar o pipeline.
- O botão "voltar" do editor continua retornando para o card do lead.
- Sidebar continua destacando "CRM" enquanto o editor está aberto vindo do CRM.
- Abrir uma cotação pelo pipeline normal (`/quotes`) continua funcionando como hoje, sem regressão.

## Arquivos
- `src/pages/Quotes.tsx`
- `src/pages/LeadDetail.tsx`