-- Bucket privado para documentos de leads do CRM
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-documents', 'lead-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Tabela de documentos do lead
CREATE TABLE public.lead_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_documents_lead_id ON public.lead_documents(lead_id);

ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão das notas: usuários autenticados podem visualizar, criar e remover
CREATE POLICY "Authenticated users can view lead documents"
ON public.lead_documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert lead documents"
ON public.lead_documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lead documents or admins can delete any"
ON public.lead_documents FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

-- Storage policies para o bucket lead-documents
CREATE POLICY "Authenticated users can read lead documents storage"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'lead-documents');

CREATE POLICY "Authenticated users can upload lead documents storage"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lead-documents');

CREATE POLICY "Authenticated users can delete lead documents storage"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lead-documents');