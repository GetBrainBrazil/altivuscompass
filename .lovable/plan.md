## Refatorar diálogo "Copiar Passageiros de Outro Cliente"

Hoje o diálogo é um fluxo de 2 etapas: primeiro escolhe o cliente de origem, depois escolhe quais passageiros copiar. O usuário quer transformar em uma única lista: buscar passageiros direto (entre todos os clientes), mostrando ao lado o cliente de origem. Apenas passageiros que ainda não viraram clientes aparecem.

### Mudanças em `src/components/ClientTravelersTab.tsx`

1. **Tooltip no botão "Copiar de outro cliente"** (linha ~611–613)
   - Envolver em `Tooltip` com texto: "Lista apenas passageiros que ainda não foram promovidos a clientes."

2. **Nova query unificada de passageiros** (substitui `copyClientPassengers`)
   - `useQuery(["all-passengers-not-clients"], ...)` habilitada quando `copyDialog` está aberto.
   - SELECT em `passengers` com join lógico: `id, full_name, cpf, birth_date, passport_number, nationality, client_id, client:clients!passengers_client_id_fkey(id, full_name)`.
   - Filtros aplicados no cliente:
     - excluir passageiros do próprio `clientId` atual (origem ≠ destino);
     - excluir passageiros que já são clientes: marcar como "já é cliente" todo passageiro cujo `cpf` (limpo) bate com algum `clients.cpf_cnpj`, ou cujo `full_name + birth_date` bate com algum cliente (uso `allClients` já existente, ampliando o SELECT para incluir `cpf_cnpj, birth_date`).

3. **UI do diálogo** (linhas ~945–1044)
   - Remover a etapa "selecionar cliente de origem". Mostrar sempre uma única lista buscável.
   - Cabeçalho: título mantido + `DialogDescription` curta: "Apenas passageiros ainda não cadastrados como clientes. O cliente de origem aparece ao lado do nome."
   - Campo de busca único: filtra por nome do passageiro **ou** nome do cliente de origem.
   - Tabela com colunas: checkbox, Nome (passageiro), Cliente de origem (com link/ícone), Nascimento, Passaporte.
   - Estado vazio: "Nenhum passageiro disponível para copiar."
   - Botão "Copiar N passageiro(s)" mantém o comportamento do `copyPassengersMutation` (que já opera sobre os IDs em `copyPassengerIds`), apenas adaptando para a nova fonte de dados (`allPassengersNotClients` em vez de `copyClientPassengers`).

4. **Estado/limpeza**
   - Remover `selectedCopyClient`, `copyClientSearch` virou busca global de passageiro/cliente.
   - Resetar `copyPassengerIds` e busca ao fechar.

### Verificação
- Abrir diálogo: deve aparecer lista de passageiros com coluna "Cliente de origem".
- Passageiros promovidos (que viraram clientes com mesmo CPF ou mesmo nome+nascimento) NÃO devem aparecer.
- Tooltip do botão aparece ao hover.
- Selecionar múltiplos e copiar deve continuar funcionando (mutation inalterada).
