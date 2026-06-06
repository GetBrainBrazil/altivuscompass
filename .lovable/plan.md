## Objetivo

Na Central de Atendimento, o painel lateral direito deixa de ser apenas "Resumo IA / CRM" e passa a oferecer uma visão **Cliente 360** com abas condicionais por nível do contato (Prospect / Lead / Cliente), edição completa equivalente às telas dedicadas, e atalhos para Cotações, Vendas e Pós-venda. Em paralelo, a conversa do WhatsApp continua **contínua** (sem sessões obrigatórias), mas permite **marcar mensagens** (uma ou várias) e vinculá-las a uma ou mais Cotações / Vendas / Pós-vendas.

## Parte 1 — Painel lateral por nível

O painel direito mostra abas diferentes conforme o nível do contato selecionado:

| Nível | Abas exibidas |
| --- | --- |
| **Prospect** | Cliente · Resumo IA |
| **Lead** | Cliente · Cotações · Resumo IA |
| **Cliente** | Cliente · Cotações · Vendas · Pós-venda · Resumo IA |

Notas:
- A aba **Cliente** existe sempre, mesmo quando o contato ainda não foi promovido — é a "ficha" do contato (dados, contatos, endereços, etc.). Para Prospect/Lead ela edita os dados disponíveis em `contacts` + `leads` (campos básicos + viagem); para Cliente, edita o registro completo em `clients` e tabelas relacionadas.
- Largura atual (340px) cresce para ~420–460px em desktop ≥1280px. Em telas menores, vira drawer fullscreen acionado por botão no header da conversa.
- Cada aba carrega lazy via React Query, mantendo Realtime quando aplicável.

### Aba Cliente
- **Prospect/Lead** (sem `client_id`): formulário compacto com nome, telefones, e-mails, origem, e — quando for Lead — campos de viagem (destino, datas, viajantes, orçamento, preferências). Reaproveita `LeadDetailPanel`/`LeadConvert` em formato embed.
- **Cliente** (com `client_id`): reaproveita a estrutura de `src/pages/Clients.tsx` (sub-abas Dados, Endereços, Contatos, Passaportes, Vistos, Milhas, Viajantes, Documentos, Conversas).
- Refatorar o conteúdo do modal atual de Clients em um componente `ClientFormContent` puro (sem `Dialog`) e reusá-lo no painel; saves usam as mesmas mutations já existentes (edição equivalente à da página dedicada).
- Botão "Abrir em página inteira" leva para `/clients?id=<id>` (cliente) ou `/leads/<id>` (lead) preservando o estado.

### Aba Cotações (Lead e Cliente)
- Lista todas as `quotes` onde `lead_id` aponta para o lead atual, ou cujo `lead.converted_client_id = client.id`.
- Cards compactos: título, estágio (badge), valor, última atualização.
- Ações inline: mudar estágio (drop-down idêntico ao Sales kanban), abrir em `/quotes?id=<id>`, **+ Nova cotação** (atalho).
- Edição completa = abrir a cotação no formulário existente; inline mantém só ações leves (estágio, conclusão).

### Aba Vendas (somente Cliente)
- Mostra `quotes` em estágio `confirmed`/`won` do cliente + recebíveis vinculados (`payables_receivables` com `quote_id`).
- Permite alterar status do recebível (pago/pendente) e abrir cotação/recebível.

### Aba Pós-venda (somente Cliente)
- Para vendas confirmadas, lista as viagens com placeholders de checklist e botão "Abrir pós-venda" que leva para `/sales`/`/quotes`. Sem criar tabelas novas para pós-venda neste passo — apenas expor o ponto de entrada e a estrutura visual.

### Aba Resumo IA (sempre)
- Conteúdo atual de `LeadSummaryPanel` (resumo, destino, pessoas, duração, orçamento, anotações IA), movida para o fim do menu.

## Parte 2 — Vínculo de mensagens a Cotação / Venda / Pós-venda

Decisão: **não amarrar conversas em sessões agora**. A conversa do WhatsApp continua única e contínua por contato. O atendente pode marcar manualmente **uma ou várias mensagens** e atribuí-las a **um ou mais** itens.

### UX
- Cada bolha de mensagem ganha um menu "•••" com a opção **"Vincular a..."**.
- Modo de seleção múltipla por checkbox, acionado no header da conversa.
- Dialog de vínculo lista Cotações / Vendas / Pós-vendas **do contato/cliente atual** com checkboxes (multi-select).
- Mensagens vinculadas mostram um chip discreto no rodapé da bolha: "Cotação #123" / "Venda #45" / "Pós-venda #7" (clicável → abre o item).
- Nas abas Cotações/Vendas/Pós-venda do painel, cada item exibe "X mensagens vinculadas" e abre a conversa filtrada por essas mensagens.

### Modelagem
Tabela nova `wa_message_links`:
- `id`, `message_id` (FK `wa_messages.id` ON DELETE CASCADE), `quote_id` (nullable), `receivable_id` (nullable), `post_sale_id` (nullable, reservado), `created_by`, `created_at`.
- CHECK garantindo que pelo menos uma das três FKs esteja preenchida.
- Índices por `message_id` e por cada FK.
- RLS no padrão dos demais módulos (usuário autenticado lê/escreve; service_role total).
- GRANTs explícitos para `authenticated` e `service_role`.

Sem alterar `wa_conversations`/`wa_messages` (zero impacto no webhook e na dedup atual).

## Detalhes técnicos

- Extrair de `src/pages/Clients.tsx` o conteúdo do modal de edição para `src/components/clients/ClientFormContent.tsx`, mantendo a página dedicada usando o mesmo componente.
- Criar `src/components/service-center/ClientSidePanel.tsx` com `Tabs` condicionais baseadas em `contact.level`. Renderizado em `ServiceCenter.tsx` no lugar do bloco atual (`summary`/`crm`).
- Criar `src/components/service-center/MessageLinkDialog.tsx` (multi-select de cotações/vendas/pós-vendas) e hook `useMessageLinks` para leitura/escrita em `wa_message_links`.
- No `MessageList` da Central, fazer fetch agregado dos links por intervalo de IDs visíveis (1 query por página, nunca 1 por mensagem).
- Migração SQL: `CREATE TABLE wa_message_links (...)` + GRANTs + RLS + policies.

## Fora de escopo

- Não criar tabela própria de "pós-venda" agora — só ponto de entrada visual.
- Não introduzir "sessão" automática por inatividade nem encerramento manual de sessão.
- Não alterar webhook, dedupe, handoff humano, ou kanban de leads.
