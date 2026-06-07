## Objetivo

Evitar cadastros duplicados de clientes mostrando sugestões em tempo real enquanto o usuário digita o nome no formulário "Novo Cliente". A busca cobre tanto clientes existentes quanto passageiros (viajantes) que ainda não são clientes, podendo ser promovidos.

## Escopo

Apenas o formulário "Novo Cliente" em `src/pages/Clients.tsx` (campo `Nome completo`, linha 1228). Sem alterações em modo edição.

## Comportamento da busca em tempo real

1. A partir de 3 caracteres digitados em `Nome completo`, com debounce ~250ms, abre um popover sob o input com até 8 sugestões.
2. Busca paralela em duas fontes:
   - `clients` por `full_name ilike %query%` (limite 5).
   - `passengers` por `full_name ilike %query%` (limite 5), trazendo o `client` vinculado quando houver.
3. Cada sugestão exibe:
   - Nome + badge `Cliente` ou `Viajante`.
   - Indicadores secundários: CPF (mascarado), telefone formatado, e-mail — só quando existirem.
   - Se a sugestão for um viajante já vinculado a outro cliente, mostra "Viajante de: {nome do cliente}".

## Pontos de verificação (hierarquia de decisão)

Para reforçar a unicidade, a busca por nome é complementada por matches fortes assim que o usuário preenche outros campos (CPF, telefone, e-mail) ainda dentro do form de criação:

- **CPF** (decisivo): match exato em `clients.cpf_cnpj` ou `passengers.cpf`. Quando há match exato, exibe banner amarelo acima do form: "Já existe um cliente com este CPF — abrir registro" + botão.
- **Celular** (ponto de verificação, considerando DDD): match por sufixo de **10 ou 11 dígitos** (DDD + número, p.ex. `11987654321`) em `clients.phone` e `client_phones.phone`. O mesmo número sem DDD pode existir em estados diferentes, então o sufixo curto (8–9 dígitos) **não** é usado para esse match. Mostrado como sugestão regular (não bloqueia).
- **E-mail** (auxiliar): match em `clients.email` e `client_emails.email`. Mostrado como sugestão com nota "pode ser compartilhado".

A validação final no `handleSaveClick` (já existente em `findDuplicateCandidates`, linha 875) permanece como rede de segurança e também será ajustada para usar sufixo de 10–11 dígitos no telefone.

## Ações ao clicar numa sugestão

- **Cliente existente** → confirma com diálogo: "Abrir este cliente em vez de criar um novo?" Se sim, navega para `?id={clientId}` (modo edição). Se não, fecha sugestões e mantém digitação.
- **Viajante sem cliente** → confirma: "Este viajante ainda não é cliente. Promover a cliente preenchendo os dados?" Se sim, pré-preenche o form com `full_name`, `cpf`, `birth_date`, `nationality`, `passport_number`, `passport_expiry` e marca um estado `promoteFromPassengerId` para que, ao salvar, o `passengers.client_id` seja atualizado para o novo cliente criado.
- **Viajante já vinculado a outro cliente** → confirma: "Este viajante já pertence ao cliente X. Abrir cliente X?" e navega para o cliente vinculado.

## Detalhes técnicos

- Novo componente `src/components/clients/ClientNameSuggest.tsx` (Popover + lista, padrão visual do `LeadClientPicker`).
- Hook `useQuery` com `queryKey: ["client-name-suggest", debouncedQuery]`, `enabled: debouncedQuery.length >= 3`.
- Debounce inline com `useEffect` + `setTimeout` (sem nova dependência).
- Reuso de `ContactLevelBadge` para "Cliente" e novo estilo para "Viajante".
- Promoção de viajante: dentro de `saveMutation.onSuccess`, se `promoteFromPassengerId` estiver setado, executar `update passengers set client_id = newClient.id where id = promoteFromPassengerId`.
- Banner de CPF duplicado: bloco condicional acima do card do form, só aparece com CPF de 11/14 dígitos e match exato.
- Match de telefone usa `cleanDigits(...).slice(-11)` (mín. 10) — garante que o DDD entra na comparação.

## Arquivos afetados

- `src/pages/Clients.tsx` — integrar componente no input de nome, estado `promoteFromPassengerId`, ajuste no `saveMutation`, banner CPF, ajuste do sufixo no `findDuplicateCandidates`.
- `src/components/clients/ClientNameSuggest.tsx` — novo componente.

## Fora do escopo

- Mudanças no modo edição.
- Merge automático de registros existentes.
- Mudanças em RLS, schema ou outros formulários (leads, contatos).