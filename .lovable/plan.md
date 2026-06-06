## Lembretes de tarefas — multi-canal

Hoje já existe `task_reminders` (com `task_id`, `user_id`, `remind_at`, `is_read`), mas sem canais e sem disparo. Vou estendê-la e construir UI + worker.

### 1. Banco — extensão de `task_reminders`

Novas colunas:
- `channels text[]` — combinação de `system` / `whatsapp` / `email` (default `{system}`)
- `message text` — opcional, default = título da tarefa
- `status text` — `pending` | `sent` | `failed` | `cancelled`
- `sent_at timestamptz`, `error text`, `delivered_channels text[]`

RLS mantém escopo `user_id = auth.uid()`.

### 2. UI no formulário da tarefa

A coluna direita (`TaskNotesHistory`) ganha uma seção **"Lembretes"** posicionada **entre a Nota e o Histórico**. Componente novo `TaskReminders` injetado pelo `TaskNotesHistory` nesse ponto.

Cada item da lista:
- Data (DD/MM/AAAA) + Hora (HH:mm)
- Checkboxes de canal: **Sistema** (marcado por padrão, não pode desligar), **WhatsApp**, **Email**
- Mensagem opcional (placeholder = título da tarefa)
- Botão remover
- Botão **"+ Adicionar lembrete"** para vários lembretes

Salvar é imediato (insert/update direto na tabela, sem precisar clicar em "Salvar tarefa"). Lembretes já disparados aparecem em cinza com badge "Enviado".

### 3. Popup do canal Sistema (canto inferior direito)

Novo `<ReminderPopupCenter />` montado uma vez no `App.tsx`:
- Realtime em `task_reminders` do usuário + polling de 30s para `remind_at <= now()` com canal `system` e `is_read=false`
- Card fixo bottom-right (empilha se houver vários) com título, mensagem, horário, **"Abrir tarefa"** e **"Dispensar"** (marca `is_read=true`)

### 4. Worker de disparo

Nova edge function `dispatch-task-reminders`:
- Busca `status='pending' AND remind_at <= now()`
- **whatsapp**: telefone do contato/cliente vinculado à tarefa, ou do responsável (`profiles.phone`); invoca `send-whatsapp`
- **email**: invoca `send-transactional-email` com template `task-reminder`
- **system**: nada (o popup lê do banco)
- Atualiza `status`, `sent_at`, `delivered_channels`, `error`

Cron `pg_cron` a cada 1 min via `supabase--insert`.

### 5. Pré-requisito do canal Email

A infra de App Emails ainda não está instalada. Ao aprovar, rodo `setup_email_infra` + `scaffold_transactional_email` e crio o template `task-reminder`. Se preferir, entrego **Sistema + WhatsApp** primeiro e o **Email** depois — me avise na aprovação.

### Arquivos
- migration `task_reminders`
- `src/components/tasks/TaskReminders.tsx` (novo)
- `src/components/tasks/TaskNotesHistory.tsx` (injeta seção entre Nota e Histórico)
- `src/components/ReminderPopupCenter.tsx` (novo)
- `src/App.tsx` (monta popup)
- `supabase/functions/dispatch-task-reminders/index.ts` (novo)
- `supabase/functions/_shared/transactional-email-templates/task-reminder.tsx` (se incluir email)
- cron via `supabase--insert`
