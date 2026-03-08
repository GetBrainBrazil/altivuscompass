
-- Create relationship type enum
CREATE TYPE public.relationship_type AS ENUM ('spouse', 'child', 'parent', 'employee', 'partner', 'sibling', 'other');

-- Create client_relationships table
CREATE TABLE public.client_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id_a UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_id_b UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  relationship_type relationship_type NOT NULL DEFAULT 'other',
  relationship_label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id_a, client_id_b)
);

-- Enable RLS
ALTER TABLE public.client_relationships ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view client_relationships" ON public.client_relationships FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert client_relationships" ON public.client_relationships FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update client_relationships" ON public.client_relationships FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete client_relationships" ON public.client_relationships FOR DELETE TO authenticated USING (true);
