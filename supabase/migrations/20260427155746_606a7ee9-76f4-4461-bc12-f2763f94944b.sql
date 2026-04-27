-- ============================================
-- HIERARQUIA DE CONTATOS: Prospect / Lead / Cliente
-- ============================================

-- Enum para o nível do contato
DO $$ BEGIN
  CREATE TYPE public.contact_level AS ENUM ('prospect', 'lead', 'cliente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela mestre 'contacts'
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level public.contact_level NOT NULL DEFAULT 'prospect',
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  -- Vínculos com tabelas existentes (preservam FKs filhas)
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  -- Origem
  source TEXT DEFAULT 'manual',
  -- Marcadores temporais da promoção
  promoted_to_lead_at TIMESTAMPTZ,
  promoted_to_cliente_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Garantias de integridade: cada lead/client mapeia para no máximo um contact
  CONSTRAINT contacts_unique_lead UNIQUE (lead_id),
  CONSTRAINT contacts_unique_client UNIQUE (client_id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_level ON public.contacts(level);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_id ON public.contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_client_id ON public.contacts(client_id);

-- RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.contacts;
CREATE POLICY "Authenticated users can view contacts" ON public.contacts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON public.contacts;
CREATE POLICY "Authenticated users can insert contacts" ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update contacts" ON public.contacts;
CREATE POLICY "Authenticated users can update contacts" ON public.contacts
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and managers can delete contacts" ON public.contacts;
CREATE POLICY "Admins and managers can delete contacts" ON public.contacts
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger updated_at
DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- MIGRAÇÃO DE DADOS EXISTENTES
-- ============================================

-- 1) Importar todos os 'clients' como nível 'cliente' (cliente sempre é nível mais alto)
INSERT INTO public.contacts (level, full_name, phone, email, client_id, source, promoted_to_cliente_at, created_at, updated_at)
SELECT
  'cliente'::contact_level,
  c.full_name,
  c.phone,
  c.email,
  c.id,
  'migration',
  c.created_at,
  c.created_at,
  c.updated_at
FROM public.clients c
ON CONFLICT (client_id) DO NOTHING;

-- 2) Importar 'leads' que ainda NÃO foram convertidos em cliente
--    Definir nível com base nos dados coletados:
--    - prospect: apenas nome/telefone
--    - lead: tem destino + período (start ou end) + nº viajantes
INSERT INTO public.contacts (level, full_name, phone, email, lead_id, source, promoted_to_lead_at, created_at, updated_at)
SELECT
  CASE
    WHEN l.destination IS NOT NULL
      AND (l.travel_date_start IS NOT NULL OR l.travel_date_end IS NOT NULL OR l.flexible_dates = true)
      AND l.travelers_count IS NOT NULL
    THEN 'lead'::contact_level
    ELSE 'prospect'::contact_level
  END,
  l.full_name,
  l.phone,
  l.email,
  l.id,
  COALESCE(l.source, 'manual'),
  CASE
    WHEN l.destination IS NOT NULL
      AND (l.travel_date_start IS NOT NULL OR l.travel_date_end IS NOT NULL OR l.flexible_dates = true)
      AND l.travelers_count IS NOT NULL
    THEN l.updated_at
    ELSE NULL
  END,
  l.created_at,
  l.updated_at
FROM public.leads l
WHERE l.converted_client_id IS NULL
ON CONFLICT (lead_id) DO NOTHING;

-- 3) Para leads que JÁ foram convertidos em cliente, atualizar o contact existente
--    para apontar também ao lead_id (mantém histórico)
UPDATE public.contacts ct
SET lead_id = l.id, source = COALESCE(l.source, ct.source)
FROM public.leads l
WHERE l.converted_client_id = ct.client_id
  AND ct.level = 'cliente'
  AND ct.lead_id IS NULL;

-- ============================================
-- TRIGGERS DE AUTO-PROMOÇÃO
-- ============================================

-- Função: ao criar/atualizar um lead, sincronizar contact e promover Prospect→Lead se aplicável
CREATE OR REPLACE FUNCTION public.sync_contact_from_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_travel_data BOOLEAN;
  v_target_level public.contact_level;
  v_existing_contact_id UUID;
  v_existing_level public.contact_level;
BEGIN
  -- Determina se o lead atende aos critérios para virar Lead
  v_has_travel_data :=
    NEW.destination IS NOT NULL
    AND (NEW.travel_date_start IS NOT NULL OR NEW.travel_date_end IS NOT NULL OR NEW.flexible_dates = true)
    AND NEW.travelers_count IS NOT NULL;

  v_target_level := CASE WHEN v_has_travel_data THEN 'lead'::contact_level ELSE 'prospect'::contact_level END;

  -- Procura contact existente por lead_id
  SELECT id, level INTO v_existing_contact_id, v_existing_level
  FROM public.contacts WHERE lead_id = NEW.id LIMIT 1;

  IF v_existing_contact_id IS NULL THEN
    -- Insere novo contact (não duplica se já houver client convertido)
    IF NEW.converted_client_id IS NOT NULL THEN
      -- Já é cliente: tenta achar o contact pelo client_id
      SELECT id, level INTO v_existing_contact_id, v_existing_level
      FROM public.contacts WHERE client_id = NEW.converted_client_id LIMIT 1;

      IF v_existing_contact_id IS NOT NULL THEN
        UPDATE public.contacts SET lead_id = NEW.id WHERE id = v_existing_contact_id;
      END IF;
    ELSE
      INSERT INTO public.contacts (level, full_name, phone, email, lead_id, source, promoted_to_lead_at)
      VALUES (
        v_target_level, NEW.full_name, NEW.phone, NEW.email, NEW.id,
        COALESCE(NEW.source, 'manual'),
        CASE WHEN v_has_travel_data THEN now() ELSE NULL END
      );
    END IF;
  ELSE
    -- Atualiza contact existente. NUNCA regride: cliente continua cliente.
    IF v_existing_level = 'cliente' THEN
      UPDATE public.contacts
      SET full_name = NEW.full_name,
          phone = COALESCE(NEW.phone, phone),
          email = COALESCE(NEW.email, email)
      WHERE id = v_existing_contact_id;
    ELSE
      UPDATE public.contacts
      SET full_name = NEW.full_name,
          phone = COALESCE(NEW.phone, phone),
          email = COALESCE(NEW.email, email),
          level = v_target_level,
          promoted_to_lead_at = CASE
            WHEN v_target_level = 'lead' AND promoted_to_lead_at IS NULL THEN now()
            ELSE promoted_to_lead_at
          END
      WHERE id = v_existing_contact_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contact_from_lead ON public.leads;
CREATE TRIGGER trg_sync_contact_from_lead
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_contact_from_lead();

-- Função: ao criar/atualizar um client, garantir que existe um contact de nível 'cliente'
CREATE OR REPLACE FUNCTION public.sync_contact_from_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_contact_id UUID;
BEGIN
  SELECT id INTO v_existing_contact_id
  FROM public.contacts WHERE client_id = NEW.id LIMIT 1;

  IF v_existing_contact_id IS NULL THEN
    INSERT INTO public.contacts (level, full_name, phone, email, client_id, source, promoted_to_cliente_at)
    VALUES ('cliente', NEW.full_name, NEW.phone, NEW.email, NEW.id, 'manual', now());
  ELSE
    UPDATE public.contacts
    SET full_name = NEW.full_name,
        phone = COALESCE(NEW.phone, phone),
        email = COALESCE(NEW.email, email),
        level = 'cliente',
        promoted_to_cliente_at = COALESCE(promoted_to_cliente_at, now())
    WHERE id = v_existing_contact_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_contact_from_client ON public.clients;
CREATE TRIGGER trg_sync_contact_from_client
  AFTER INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_contact_from_client();

-- ============================================
-- AUTO-PROMOÇÃO Lead → Cliente via pagamento de cotação
-- ============================================
-- Quando um financial_transaction tipo 'income' com status 'paid' é vinculado a uma quote
-- que pertence a um lead (via leads.id em quotes.lead_id), promovemos para Cliente.

CREATE OR REPLACE FUNCTION public.promote_contact_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id UUID;
  v_lead RECORD;
  v_new_client_id UUID;
  v_contact RECORD;
BEGIN
  -- Só age em receitas pagas vinculadas a uma cotação
  IF NEW.type IS DISTINCT FROM 'income' THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM 'paid' THEN RETURN NEW; END IF;
  IF NEW.quote_id IS NULL THEN RETURN NEW; END IF;

  -- Busca o lead vinculado à cotação (se houver coluna lead_id em quotes)
  BEGIN
    EXECUTE 'SELECT lead_id FROM public.quotes WHERE id = $1' INTO v_lead_id USING NEW.quote_id;
  EXCEPTION WHEN undefined_column THEN
    -- Se quotes.lead_id não existir, ignora
    RETURN NEW;
  END;

  IF v_lead_id IS NULL THEN RETURN NEW; END IF;

  -- Busca o contact desse lead
  SELECT * INTO v_contact FROM public.contacts WHERE lead_id = v_lead_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Se já é cliente, nada a fazer
  IF v_contact.level = 'cliente' THEN RETURN NEW; END IF;

  -- Busca dados do lead
  SELECT * INTO v_lead FROM public.leads WHERE id = v_lead_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Cria cliente automaticamente com dados mínimos (admin pode completar depois)
  IF v_lead.converted_client_id IS NULL THEN
    INSERT INTO public.clients (full_name, phone, email, notes)
    VALUES (
      v_lead.full_name,
      v_lead.phone,
      v_lead.email,
      COALESCE('Convertido automaticamente após pagamento. ' || COALESCE(v_lead.ai_summary, ''), '')
    )
    RETURNING id INTO v_new_client_id;

    -- Atualiza lead
    UPDATE public.leads
    SET converted_client_id = v_new_client_id,
        converted_at = now(),
        status = 'converted'
    WHERE id = v_lead_id;
  ELSE
    v_new_client_id := v_lead.converted_client_id;
  END IF;

  -- Promove contact para 'cliente'. Status nunca regride.
  UPDATE public.contacts
  SET level = 'cliente',
      client_id = v_new_client_id,
      promoted_to_cliente_at = COALESCE(promoted_to_cliente_at, now())
  WHERE id = v_contact.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_contact_on_payment ON public.financial_transactions;
CREATE TRIGGER trg_promote_contact_on_payment
  AFTER INSERT OR UPDATE ON public.financial_transactions
  FOR EACH ROW EXECUTE FUNCTION public.promote_contact_on_payment();

-- ============================================
-- Sync ON DELETE: limpa contacts quando lead/client são removidos
-- ============================================
-- (já tratado pelos ON DELETE SET NULL nas FKs; o contact permanece com o nível atual)
