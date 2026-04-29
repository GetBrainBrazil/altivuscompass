## Objetivo
Fazer com que a cotação aberta a partir do CRM continue com aparência de contexto do CRM na barra lateral, sem quebrar o comportamento atual de voltar para o card da pessoa. Quando a cotação for aberta diretamente pelo módulo de Cotações, tudo continua como hoje.

## O que vou ajustar
1. Consolidar a origem da navegação CRM -> Cotação
- Expandir o metadado já salvo para retorno (`quotes:returnTo`) para também guardar o contexto visual de origem.
- Salvar algo como: origem = `crm`, URL de retorno e timestamp.
- Aplicar isso em todos os pontos do perfil do lead que abrem uma cotação existente ou criam uma nova.

2. Preservar esse contexto dentro de `Quotes.tsx`
- Hoje o fluxo de `Quotes.tsx` limpa `location.state` ao normalizar `?edit=` e `newQuote`, o que apaga a noção de origem.
- Ajustar a lógica para manter o contexto de origem enquanto o editor foi aberto a partir do CRM.
- Garantir que isso funcione tanto para:
  - abrir cotação existente via `?edit=<id>`
  - criar nova cotação via `state.newQuote`
  - abrir depois de um refresh recente, se o contexto ainda estiver válido

3. Fazer a sidebar respeitar o contexto visual
- Em `AppSidebar.tsx`, calcular um “caminho efetivo ativo” para a navegação.
- Regra:
  - se a rota real for `/quotes` e houver contexto ativo vindo do CRM, destacar `CRM` na sidebar
  - não destacar `Cotações` nesse caso
  - se a cotação foi aberta pelo fluxo normal de Cotações, a sidebar continua destacando `Cotações`
- Manter compatibilidade com os subitens já existentes do CRM.

4. Limpar o contexto na hora certa
- Ao fechar o editor e voltar ao CRM, remover o contexto temporário.
- Ao entrar em `/quotes` pelo caminho normal do módulo de Cotações, não usar contexto antigo.
- Manter a proteção de expiração curta para evitar “vazamento” de contexto entre navegações antigas.

## Resultado esperado
- Abriu cotação pelo CRM: sidebar continua mostrando CRM como módulo ativo enquanto a cotação estiver aberta.
- Clicou para voltar: volta para o card do CRM como já está hoje.
- Abriu cotação pelo pipeline de Cotações: sidebar continua mostrando Cotações.
- As cotações seguem conectadas ao pipeline global, sem duplicação nem perda de vínculo.

## Arquivos previstos
- `src/pages/LeadDetail.tsx`
- `src/pages/Quotes.tsx`
- `src/components/AppSidebar.tsx`

## Detalhes técnicos
- A sidebar hoje usa `useLocation()` e ativa itens por `location.pathname`, então `/quotes` sempre acende “Cotações”.
- O fluxo atual de retorno CRM -> Cotação já existe via `sessionStorage`, então a solução mais segura é reutilizar esse mesmo padrão para o contexto visual.
- O cuidado principal será não apagar esse contexto quando `Quotes.tsx` fizer os `navigate(..., { replace: true, state: {} })` usados para abrir o editor via query/state.
- A solução será restrita ao comportamento visual e de navegação; não altera o vínculo de dados entre CRM e Cotações.