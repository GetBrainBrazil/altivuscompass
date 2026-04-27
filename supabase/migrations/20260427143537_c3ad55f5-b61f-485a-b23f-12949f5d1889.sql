CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'new',
  destination TEXT,
  travel_date_start DATE,
  travel_date_end DATE,
  flexible_dates BOOLEAN NOT NULL DEFAULT false,
  flexible_dates_description TEXT,
  travelers_count INTEGER,
  preferences TEXT,
  ai_summary TEXT,
  ai_collected_data JSONB DEFAULT '{}'::jsonb,
  converted_client_id UUID,
  converted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update leads" ON public.leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins and managers can delete leads" ON public.leads FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);

INSERT INTO public.leads (full_name, phone, source, status, destination, travel_date_start, travel_date_end, travelers_count, preferences, ai_summary, ai_collected_data) VALUES
('Maria Silva', '+5511988887777', 'whatsapp_ai', 'new', 'Paris, França', '2026-07-10', '2026-07-20', 2, 'Hotel próximo à Torre Eiffel, voo direto, café da manhã incluso', 'Cliente interessada em lua de mel em Paris. Prefere hotéis de luxo e quer fazer passeio guiado pelo Louvre.', '{"intent":"honeymoon","budget_range":"luxury","accommodation":"5-star","interests":["culture","gastronomy"]}'::jsonb),
('João Pereira', '+5511977776666', 'whatsapp_ai', 'new', 'Bariloche, Argentina', '2026-08-01', '2026-08-08', 4, 'Família com crianças, hotel com estrutura kids, transfer do aeroporto', 'Família de 4 pessoas (2 adultos + 2 crianças) buscando viagem de neve em Bariloche. Querem incluir aulas de ski.', '{"intent":"family_trip","budget_range":"medium","accommodation":"4-star","interests":["snow","adventure"],"children_ages":[8,12]}'::jsonb);
