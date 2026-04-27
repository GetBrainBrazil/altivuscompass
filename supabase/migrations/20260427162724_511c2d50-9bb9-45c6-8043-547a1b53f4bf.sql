
-- ============================================
-- 1. Adiciona lead_id em quotes (se ainda não existir) para vincular cotação ao lead originador
-- ============================================
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_lead_id ON public.quotes(lead_id);

-- ============================================
-- 2. Backfill: tenta vincular cotações existentes ao lead via client_id
-- ============================================
UPDATE public.quotes q
SET lead_id = l.id
FROM public.leads l
WHERE q.lead_id IS NULL
  AND q.client_id IS NOT NULL
  AND l.converted_client_id = q.client_id;

-- ============================================
-- 3. Trigger: promove Lead -> Cliente quando quote vira confirmed + won
--    (não depende mais de pagamento explícito)
-- ============================================
CREATE OR REPLACE FUNCTION public.promote_contact_on_quote_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_new_client_id UUID;
  v_contact RECORD;
BEGIN
  -- Dispara somente quando entra em confirmed + won
  IF NEW.stage IS DISTINCT FROM 'confirmed' THEN RETURN NEW; END IF;
  IF NEW.conclusion_type IS DISTINCT FROM 'won' THEN RETURN NEW; END IF;

  -- Evita reprocessar se já estava confirmed/won antes
  IF TG_OP = 'UPDATE'
     AND OLD.stage = 'confirmed'
     AND OLD.conclusion_type = 'won' THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_contact FROM public.contacts WHERE lead_id = NEW.lead_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_contact.level = 'cliente' THEN RETURN NEW; END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = NEW.lead_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_lead.converted_client_id IS NULL THEN
    INSERT INTO public.clients (full_name, phone, email, notes)
    VALUES (
      v_lead.full_name,
      v_lead.phone,
      v_lead.email,
      COALESCE('Convertido automaticamente ao concluir cotação. ' || COALESCE(v_lead.ai_summary, ''), '')
    )
    RETURNING id INTO v_new_client_id;

    UPDATE public.leads
    SET converted_client_id = v_new_client_id,
        converted_at = now(),
        status = 'converted'
    WHERE id = NEW.lead_id;
  ELSE
    v_new_client_id := v_lead.converted_client_id;
  END IF;

  -- Promove contact para cliente. NUNCA regride.
  UPDATE public.contacts
  SET level = 'cliente',
      client_id = v_new_client_id,
      promoted_to_cliente_at = COALESCE(promoted_to_cliente_at, now())
  WHERE id = v_contact.id;

  -- Notifica admins/managers da promoção a Cliente
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  SELECT ur.user_id,
         'client_promoted',
         'Novo Cliente conquistado',
         COALESCE(v_lead.full_name, 'Contato') || ' foi promovido a Cliente. Complete os dados para emissão.',
         '/contacts',
         jsonb_build_object('contact_id', v_contact.id, 'client_id', v_new_client_id, 'quote_id', NEW.id, 'needs_complementary_data', true)
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'manager');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_contact_on_quote_confirmed ON public.quotes;
CREATE TRIGGER trg_promote_contact_on_quote_confirmed
  AFTER INSERT OR UPDATE OF stage, conclusion_type ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.promote_contact_on_quote_confirmed();

-- ============================================
-- 4. Trigger anti-regressão: contact.level = 'cliente' nunca regride para lead/prospect
-- ============================================
CREATE OR REPLACE FUNCTION public.prevent_contact_level_regression()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.level = 'cliente' AND NEW.level <> 'cliente' THEN
    RAISE EXCEPTION 'O nível "Cliente" é permanente e não pode regredir para % .', NEW.level
      USING ERRCODE = 'check_violation';
  END IF;
  -- Lead também não regride para prospect (apenas evolui para cliente)
  IF OLD.level = 'lead' AND NEW.level = 'prospect' THEN
    NEW.level := 'lead';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_contact_level_regression ON public.contacts;
CREATE TRIGGER trg_prevent_contact_level_regression
  BEFORE UPDATE OF level ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_contact_level_regression();
