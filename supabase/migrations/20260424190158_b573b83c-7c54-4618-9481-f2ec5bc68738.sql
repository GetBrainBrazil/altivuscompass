
-- Notas e histórico de atividades de tarefas
CREATE TABLE public.task_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_notes_task_id ON public.task_notes(task_id);

ALTER TABLE public.task_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task notes"
  ON public.task_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create task notes"
  ON public.task_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task notes"
  ON public.task_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task notes"
  ON public.task_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Histórico de atividades (criação, mudanças de campo, etc.)
CREATE TABLE public.task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL, -- 'created' | 'updated' | 'status_changed' | 'assigned' | 'completed'
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_activity_task_id ON public.task_activity(task_id);

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task activity"
  ON public.task_activity FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create task activity"
  ON public.task_activity FOR INSERT TO authenticated WITH CHECK (true);
