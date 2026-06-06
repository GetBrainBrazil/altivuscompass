## Objetivo

Eliminar a promoção manual de Prospect → Lead → Cliente, mantendo apenas o fluxo automático (que já existe no banco). O conceito agora é:

- **Prospect**: alguém que entrou em contato (ou queremos contatar), sem interesse declarado.
- **Lead**: demonstrou interesse em um produto (ex.: ao se criar uma cotação para ele).
- **Cliente**: contratou um produto (ao concluir uma cotação como `won` / receber pagamento).
- Fluxo é **estritamente sequencial e irreversível** (Prospect → Lead → Cliente, nunca regride, nunca pula).

## O que será removido (apenas UI/rota — sem mexer em lógica de negócio)

1. **Pílula "Promover"** na lista de Clientes (`src/pages/Clients.tsx`, linhas ~2082-2105, incluindo o Tooltip recém-adicionado).
2. **Botão "Promover"** na lista de Contatos (`src/pages/Contacts.tsx`, linhas ~220-233).
3. **Página** `src/pages/PromoteContact.tsx` (rota `/contacts/:id/promote`).
4. **Componente** `src/components/contacts/PromoteToLeadDialog.tsx` (não é referenciado em nenhum outro lugar — confirmar no commit).
5. **Rota e import** correspondentes em `src/App.tsx` (linhas 13 e 80).
6. Notificações com `link` apontando para `/contacts/:id/promote` (se houver) continuam válidas porque a página apenas deixará de existir; ajustaremos para apontar para `/clients?contact=:id`.

## O que permanece

- Componentes de **promoção a Cliente** acionados por contexto de cotação (`ClientPromotionDialog`, `ClientTravelersTab`) — esses são parte do fluxo automático ao fechar cotação (captura de dados complementares dos viajantes), não são "promoção manual" de nível, então **ficam**.
- Triggers no banco:
  - `sync_contact_from_lead` — define `prospect` ou `lead` conforme o lead já tenha destino + datas + nº de viajantes (interesse demonstrado).
  - `promote_contact_on_quote_confirmed` e `promote_contact_on_payment` — promovem a Cliente automaticamente.
  - `prevent_contact_level_regression` — garante que nunca volta.
  - `notify_contact_promoted_to_lead` — notifica admins/managers.

## Garantia adicional (banco)

Para fechar a regra "Lead = demonstrou interesse em um produto", adicionar uma promoção automática extra: **ao criar uma `quote` vinculada a um `lead` cujo contato ainda está como `prospect`, promover o contato para `lead`** (e gravar `promoted_to_lead_at`). Isso cobre o caso em que o lead foi criado sem destino/datas no primeiro momento, mas já recebeu uma cotação.

```text
trigger trg_promote_contact_on_quote_created
  AFTER INSERT ON quotes
  → se contacts.level = 'prospect' para o lead_id da quote
  → UPDATE contacts SET level='lead', promoted_to_lead_at = now()
```

## Verificação pós-implementação

- Build limpo (sem imports órfãos de `PromoteContact` / `PromoteToLeadDialog`).
- Nenhum link visível para `/contacts/:id/promote` na UI.
- Criar uma cotação para um Prospect deve, após o INSERT, deixá-lo como Lead automaticamente (testado por leitura do registro).
