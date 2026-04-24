
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task attachments"
  ON public.task_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert task attachments"
  ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete task attachments"
  ON public.task_attachments FOR DELETE TO authenticated USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can view task files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can upload task files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can delete task files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments');
