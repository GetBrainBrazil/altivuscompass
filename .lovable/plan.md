## Proposta: unificar em um único botão "+ Adicionar viajante" com busca inteligente e vínculo bidirecional

Sim, é totalmente viável e melhora bastante a UX. Hoje o usuário precisa decidir antes qual fluxo seguir ("é cliente? é passageiro de outro? é novo?") — carga cognitiva desnecessária. Com um único ponto de entrada que busca enquanto digita, a decisão vira automática.

### Como funcionaria

1. Apenas um botão no topo da seção Viajantes: **+ Adicionar viajante**.
2. Ao abrir, o foco vai direto para o campo **Nome completo**.
3. Conforme digita (a partir de 2 caracteres, debounce ~200ms), aparece uma lista de sugestões com 3 categorias visualmente distintas:
   - **Clientes** (badge azul) — cria vínculo via `client_relationships`.
   - **Passageiros de outros clientes** (badge cinza com o nome do cliente de origem) — copia para este cliente.
   - Linha final fixa: **"+ Cadastrar [nome digitado] como novo passageiro"**.
4. Cada sugestão mostra nome, CPF mascarado, nascimento e origem, para evitar confusão com homônimos.
5. **Mini-confirm de vínculo bidirecional** (passo essencial):
   - Ao escolher um Cliente ou um Passageiro existente, abre um confirm pequeno com **dois selects de vínculo**:
     - "{Cliente atual} é **___** de {Selecionado}" (ex.: pai)
     - "{Selecionado} é **___** de {Cliente atual}" (ex.: filho) — preenchido automaticamente pelo inverso do primeiro, mas editável
   - Tipos simétricos (cônjuge, sócio, irmão) travam os dois lados iguais.
   - Tipos assimétricos (pai↔filho, funcionário↔sócio) sugerem o inverso correto via tabela `INVERSE_RELATIONSHIP` já existente, mas o usuário pode ajustar se o inverso real for diferente (ex.: "outro").
6. Ao clicar em "Cadastrar novo" → abre o form completo de passageiro já com o nome preenchido, contendo também o campo "Vínculo com o cliente" (que é unidirecional, já que passageiro não é cliente — sem inverso necessário).

### Como o vínculo bidirecional é gravado

- **Cliente ↔ Cliente** (escolheu um cliente da busca):
  - Grava 1 linha em `client_relationships` com `client_id_a` = cliente atual, `client_id_b` = selecionado, `relationship_type` = tipo do lado A→B.
  - Se o usuário ajustar manualmente o inverso para algo diferente do automático, salvamos em `relationship_label` (campo livre já existente) ou criamos uma segunda linha invertida. **Decisão proposta:** continuar com 1 linha + tabela `INVERSE_RELATIONSHIP` para exibição (como já funciona hoje no `sortedRelationships`), só usando `relationship_label` quando o inverso for customizado.
- **Passageiro de outro cliente → este cliente** (escolheu um passageiro):
  - Copia o passageiro para o cliente atual (mantém comportamento atual de `copyPassengersMutation`).
  - `passenger.relationship_type` desta cópia recebe o tipo "este cliente é ___ do passageiro" invertido pela tabela, já que o campo descreve o vínculo do passageiro com o cliente dono da ficha.
- **Novo passageiro**: como hoje, só um lado (`passenger.relationship_type`).

### Por que isso é melhor (UX)

- **Um caminho, não três.** O sistema descobre se é cliente, passageiro existente ou novo.
- **Vínculo correto dos dois lados em uma só etapa**, sem o usuário precisar abrir a ficha do outro cliente para corrigir.
- **Menos duplicidade**: descobre passageiros/clientes existentes antes de criar um novo.
- **Menos cliques** no fluxo comum (novo passageiro continua em 2 cliques).
- **Descoberta natural** de vinculação sem precisar conhecer botões escondidos.

### Pontos de atenção

- **Performance:** reaproveitar `allClients` e `all-passengers-cross-client` já existentes; filtro no client-side por enquanto, paginação só se necessário.
- **Visual:** badges distintos (Cliente/Passageiro) para a lista de sugestões.
- **Promover a cliente** continua intacto (botão na linha da tabela).
- **Tipos simétricos** (cônjuge, irmão, sócio): travar campo do inverso = ao primeiro.

### Arquivos a alterar

- `src/components/ClientTravelersTab.tsx`:
  - Remover botões "Copiar passageiro" e "Vincular Cliente" do header (linhas ~640-655).
  - Remover dialogs `linkDialog` e `copyDialog`.
  - Criar `addTravelerDialog` com Command/Combobox de busca + sub-step de confirmação de vínculo bidirecional (com 2 selects).
  - Reaproveitar `allClients`, `allPassengersNotClients`, `linkClientMutation`, `copyPassengersMutation`, `INVERSE_RELATIONSHIP`.
  - `linkClientMutation` passa a aceitar opcionalmente `customInverseLabel` para gravar em `relationship_label` quando o inverso difere do automático.
- Sem mudanças no banco (colunas `relationship_type` e `relationship_label` já existem).

### Decisão antes de implementar

Confirmar uma única coisa: quando o usuário escolher um **Cliente** ou **Passageiro** da busca, abrimos um mini-confirm com os 2 selects de vínculo (pai/filho etc.) — concorda? Ou prefere apenas 1 campo (lado A→B) e o inverso fica implícito pela tabela, sem exibir?