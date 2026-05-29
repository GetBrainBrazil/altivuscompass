## Mudança

No `ConversationCard` em `src/pages/ServiceCenter.tsx`, remover o terceiro estado "IA pausada" e usar apenas dois badges: **IA** ou **Humano**.

Quando a IA estiver desativada globalmente (`aiGloballyPaused = true`), todos os cards passam a exibir **Humano**, independentemente do `conversation.status`. A lógica `isAi` já cobre isso (`status === "ai" && !aiGloballyPaused`), basta remover o branch intermediário.

## Resultado

- IA ativa + conversa em modo IA → badge **IA** (verde)
- IA desativada globalmente → badge **Humano** (amarelo) em todos os cards
- Conversa assumida manualmente → badge **Humano** (amarelo)
