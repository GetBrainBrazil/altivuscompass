
-- Client attachments (Docs/Anexos tab)
CREATE TABLE IF NOT EXISTS public.client_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_attachments_client_id ON public.client_attachments(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_attachments TO authenticated;
GRANT ALL ON public.client_attachments TO service_role;

ALTER TABLE public.client_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client attachments"
  ON public.client_attachments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client attachments"
  ON public.client_attachments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners or admins can delete client attachments"
  ON public.client_attachments FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- Storage policies for the client-attachments bucket
CREATE POLICY "Auth read client-attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'client-attachments');

CREATE POLICY "Auth upload client-attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'client-attachments');

CREATE POLICY "Owners or admins delete client-attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-attachments'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );
