create table public.task_reminder_action_codes(
  code text primary key,
  reminder_id uuid not null references public.task_reminders(id) on delete cascade,
  action text not null check (action in ('complete','snooze')),
  minutes int not null default 30,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
grant all on public.task_reminder_action_codes to service_role;
alter table public.task_reminder_action_codes enable row level security;
create index task_reminder_action_codes_reminder_idx on public.task_reminder_action_codes(reminder_id);