
-- Tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  priority text NOT NULL DEFAULT 'medium',
  assigned_to uuid,
  created_by uuid,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  due_date date,
  start_date date DEFAULT CURRENT_DATE,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Task reminders table
CREATE TABLE public.task_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  remind_at timestamp with time zone NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for tasks
CREATE POLICY "Authenticated users can view tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins and managers can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS policies for task_reminders
CREATE POLICY "Users can view own reminders" ON public.task_reminders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated users can insert reminders" ON public.task_reminders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own reminders" ON public.task_reminders FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own reminders" ON public.task_reminders FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for task reminders
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_reminders;
