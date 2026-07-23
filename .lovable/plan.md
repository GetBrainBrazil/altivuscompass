## Diagnóstico (confirmado no banco e nos logs)

Rodrigo tem **duas conversas** em `wa_conversations` para a mesma pessoa:

| id  | phone | last_message_at | msgs |
|---|---|---|---|
| `a85a…` | `5521996349696` (real) | 2026‑06‑18 | 97 |
| `cb98…` | `265605240352782@lid` | 2026‑07‑23 22:14 | 2 |

O teste de hoje falhou assim:
1. A auto‑resposta ("Altivus Turismo agradece…") entra pelo webhook como `fromMe=true, phone=265605240352782@lid`. O bloco de reconciliação em `whatsapp-webhook/index.ts` (linhas 640‑760) encontra a conversa `cb98` (phone=@lid) e grava a mensagem lá.
2. O inbound "oi" e "ola 23/07" entra como `phone=5521996349696, chatLid=265605240352782@lid`. A busca `chat_lid.eq.<lid>,phone.eq.<lid>` retorna `cb98` (a ordenação `phone asc` NÃO garante que dígitos venham antes de "@lid" — string "5521…" > "26560…@lid"). O código então tenta `UPDATE cb98 SET phone='5521996349696'` e bate com a unique constraint `wa_conversations_phone_key` (o registro `a85a` já tem esse phone).
3. `convoErr` fica setado, `convo` fica `null`, e o insert de `wa_messages` mais adiante é pulado — **a mensagem inbound de hoje sumiu**. É por isso que a Central "não puxou atualizações" e o cliente "aparece como outro número" (na verdade estão em duas linhas separadas).

Logs confirmam: `wa_conversations upsert error: duplicate key value violates unique constraint "wa_conversations_phone_key"` seguido de nenhum insert de mensagem inbound.

## O que fazer

### 1. Corrigir a reconciliação no webhook (`supabase/functions/whatsapp-webhook/index.ts`)

Reescrever o bloco 640‑760 para:
- **Priorizar telefone real** na busca: quando o payload traz `phone` real + `chatLid`, procurar primeiro `wa_conversations` por `phone = <real>`; só se não achar, procurar por `chat_lid = <lid>` ou `phone = <lid>`.
- **Ordenação determinística**: usar duas queries separadas em vez de um `.or(...).order('phone')`, para nunca acertar a conversa @lid quando existe a real.
- **Merge em vez de colisão**: se a busca resolver para uma conversa @lid mas já existir outra com o `phone` real, fazer:
  - `UPDATE wa_messages SET conversation_id = <real> WHERE conversation_id = <lid>`
  - `UPDATE wa_conversations SET chat_lid = <lid>, profile_photo_url = COALESCE(...), last_message_* = ... WHERE id = <real>`
  - `DELETE FROM wa_conversations WHERE id = <lid>`
  - Reapontar `resolvedConvoId` para o real e seguir o fluxo normal.
- **Nunca deixar `convo = null` silenciosamente**: se o upsert/update falhar, logar e ainda assim tentar recarregar a conversa por `phone` para não perder o `wa_messages` insert.

### 2. Reprocessar o histórico perdido

- Fazer merge manual da conversa `cb98…` (phone=@lid) na `a85a…` (Rodrigo real): mover as 2 mensagens, copiar `chat_lid` e `profile_photo_url`, apagar `cb98`.
- Rodar uma varredura genérica: para toda `wa_conversations` cujo `phone` termine em `@lid`, se existir outra conversa com o `chat_lid` igual OU cujo `phone` real bata pelo sufixo dos últimos 8 dígitos, fazer o mesmo merge. Assim conversas duplicadas antigas somem da Central.
- Chamar `whatsapp-history-sync` para o número do Rodrigo para tentar recuperar o "oi" / "ola 23/07" de hoje (Z-API pode ter em cache), caso não venha ficamos só com o que chegar a partir de agora — sem perda futura porque o webhook estará corrigido.

### 3. Verificação

- Após o deploy, mandar de novo um "oi" pelo WhatsApp e confirmar:
  - Nova mensagem aparece em `wa_messages` ligada à conversa real do Rodrigo;
  - Não gera log `duplicate key value violates unique constraint`;
  - A Central mostra a conversa no topo com o texto correto.

## Fora do escopo

Não vou mexer no layout/UI da Central nem em outras conversas que já estão corretas. Só reconciliação de identidade @lid × telefone real e recuperação das duplicatas.
