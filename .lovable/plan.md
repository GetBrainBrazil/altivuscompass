## Diagnóstico

O telefone +55 (21) 99477-2165 pertence ao cliente **Alexandre Magalhães Serrado** (em `client_phones`), mas na Central de Atendimento aparece como **Lead**. Investigando o banco:

- Existem **dois contatos** para o mesmo número:
  - `b5cfebf2…` — level=`lead`, `phone=5521994772165`, sem `client_id` (criado antes pelo webhook).
  - `4737f969…` — level=`cliente`, `phone=NULL`, com `client_id` apontando para o Alexandre (criado depois pela trigger `sync_contact_from_client`).
- A `wa_conversations` está amarrada ao contato **lead** (criada antes do cliente ter sido cadastrado) e nunca foi remapeada.
- A trigger `sync_contact_from_client` só busca contato por `client_id`. Quando já existe um contato órfão com o mesmo telefone, ela cria um segundo contato em vez de fundir.

E não há, hoje, lugar no cadastro do cliente para ver as conversas de WhatsApp dele.

## Plano

### 1. Migração de banco — fundir contatos duplicados e religar conversas

Função `merge_contact_into_client(contact_orphan_id, client_contact_id)` que:
- Reaponta `wa_conversations.contact_id`, `notifications`, `contact_events`, `lead.*` (se houver `lead_id` no órfão) para o contato cliente.
- Copia `phone`/`email`/`first_contact_at`/`last_contact_at`/`is_returning` do órfão para o contato cliente quando estiverem vazios no cliente.
- Apaga o contato órfão.

Backfill único: para cada `client_phones`, achar contato órfão (sem `client_id`) cujo telefone bate por DDD+número e fundir no contato `level='cliente'` daquele cliente.

### 2. Migração — atualizar `sync_contact_from_client`

Antes de criar um novo contato, procurar contato existente pelo telefone (DDD+número via `client_phones` do `NEW.id` + `clients.phone` legado). Se achar, promover para `cliente` e setar `client_id`, em vez de inserir duplicado. Mantém o `prevent_contact_level_regression` em ordem (lead→cliente é promoção válida).

### 3. Webhook — religar conversa existente quando o contato muda

Em `whatsapp-webhook/index.ts`, depois de `ensureContactForPhone`, se a `wa_conversation` existente do telefone tem `contact_id` diferente do retornado, atualizar `contact_id` (e `client_id`/`lead_id` derivados) da conversa. Isso evita que conversas antigas fiquem "presas" no contato errado mesmo após o cliente ser cadastrado.

### 4. ServiceCenter — recálculo defensivo do nível

Em `src/pages/ServiceCenter.tsx`, no carregamento das conversas, quando `contact.client_id` estiver presente forçar `level='cliente'` (já existe a lógica em `c.client_id ? "cliente" : c.lead_id ? "lead" : "prospect"`, mas hoje o `meta?.level` snapshot pode sobrescrever). Priorizar `client_id`/`lead_id` reais sobre o snapshot.

### 5. Aba "Conversas" na ficha do cliente

Onde ver as conversas hoje: em lugar nenhum dentro da ficha — só na Central de Atendimento. Vou adicionar uma nova aba **Conversas** em `src/pages/Clients.tsx` (modal de edição), que:
- Lista `wa_conversations` ligadas ao cliente via:
  - `contact_id` cujo `client_id = clientes.id`, **ou**
  - `phone` cuja digit-tail bate com algum `client_phones` daquele cliente (fallback caso ainda haja conversa órfã).
- Cada item mostra: número, último contato, status (IA/humano/resolvido), preview da última mensagem, e botão **Abrir na Central** que navega para `/service-center?conversation=<id>` (já suportado lá).
- Read-only nesta primeira versão (não envia mensagem direto da ficha — abre na Central).

## Detalhes técnicos

- Migração 1 e 2 são SQL puras, sem mudança de schema (apenas função e trigger). Backfill roda uma vez via `DO $$ … $$`.
- Mudança no webhook é `UPDATE wa_conversations SET contact_id=…, lead_id=…, client_id=… WHERE id=$conv AND contact_id IS DISTINCT FROM $new`.
- ServiceCenter: ajustar o trecho ~linha 1293-1296 para que `client_id`/`lead_id` da row mandem em vez de `meta?.level`.
- Nova aba: componente `ClientConversationsTab.tsx` consumindo `wa_conversations` + `wa_messages` (último resumo). Sem realtime nesta primeira entrega.

## Fora de escopo

- Não alterar política de mudança automática de status de telefone do cliente (já decidida anteriormente).
- Não enviar mensagens novas a partir da ficha do cliente neste plano.