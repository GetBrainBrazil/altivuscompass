
ALTER TABLE public.task_reminders
  ADD COLUMN IF NOT EXISTS channels text[] NOT NULL DEFAULT '{system}',
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS delivered_channels text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.task_reminders
  DROP CONSTRAINT IF EXISTS task_reminders_status_check;
ALTER TABLE public.task_reminders
  ADD CONSTRAINT task_reminders_status_check
  CHECK (status IN ('pending','sent','failed','cancelled','partial'));

CREATE INDEX IF NOT EXISTS task_reminders_dispatch_idx
  ON public.task_reminders (status, remind_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS task_reminders_user_unread_idx
  ON public.task_reminders (user_id, is_read, remind_at);
