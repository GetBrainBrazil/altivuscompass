---
name: WhatsApp Groups Support
description: Grupos do WhatsApp aparecem na Central com badge "Grupo", IA desligada por padrão
type: feature
---
- `wa_conversations` ganhou `is_group`, `group_id` (unique), `group_subject`, `ai_enabled`
- `wa_messages` ganhou `sender_phone` e `sender_name` (participante do grupo)
- Webhook: detecta `isGroup`/`@g.us`/`-group`/prefixo 120363, faz upsert por `group_id`, NÃO cria contact/lead, NÃO aciona IA nem handoff em grupos (MVP)
- send-whatsapp aceita `is_group` + `group_id` para upsert por `group_id` na hora de espelhar
- UI ServiceCenter: badge violeta "👥 Grupo" no card (sem ContactLevelBadge), nome do participante acima da bolha (texto roxo) quando `senderName` está presente
- Pré-requisito Z-API: ativar "Notificar mensagens de grupo" no painel
