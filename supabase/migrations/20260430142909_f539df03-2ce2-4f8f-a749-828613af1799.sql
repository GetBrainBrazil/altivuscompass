DROP POLICY IF EXISTS "Authenticated users can insert reminders" ON public.task_reminders;

CREATE POLICY "Users can insert own reminders"
  ON public.task_reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());