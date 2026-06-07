-- Substitui o BEFORE trigger por dois (BEFORE assignment + AFTER side effects)

CREATE OR REPLACE FUNCTION public.trg_fn_item_returned_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.return_status = 'returned' AND OLD.return_status <> 'returned' THEN
    NEW.returned_at := COALESCE(NEW.returned_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_item_returned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id UUID;
  v_deal_id  UUID;
  v_client_id UUID;
  v_alive INT;
BEGIN
  IF NEW.return_status IS NOT DISTINCT FROM OLD.return_status THEN RETURN NEW; END IF;
  IF NEW.return_status <> 'returned' THEN RETURN NEW; END IF;
  IF OLD.return_status = 'returned' THEN RETURN NEW; END IF;

  v_quote_id := NEW.quote_id;
  v_deal_id  := NEW.deal_id;

  UPDATE public.tasks
  SET status = 'cancelled', updated_at = now()
  WHERE quote_item_id = NEW.id
    AND status NOT IN ('done','cancelled');

  INSERT INTO public.deal_events (deal_id, quote_id, event_type, amount, reason_text, source, occurred_at, metadata)
  VALUES (v_deal_id, v_quote_id, 'item_returned',
          NEW.refunded_amount, NEW.return_reason, 'trigger', now(),
          jsonb_build_object('quote_item_id', NEW.id, 'title', NEW.title));

  PERFORM public.recalc_quote_item_allocations(v_quote_id);

  IF v_deal_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_alive
    FROM public.quote_items
    WHERE deal_id = v_deal_id
      AND return_status <> 'returned';

    IF v_alive = 0 THEN
      SELECT client_id INTO v_client_id FROM public.deals WHERE id = v_deal_id;

      UPDATE public.deals
      SET phase = 'selling'::deal_phase, stage = 'devolucao', updated_at = now()
      WHERE id = v_deal_id;

      INSERT INTO public.deal_events (deal_id, event_type, to_phase, to_stage, source, occurred_at, metadata)
      VALUES (v_deal_id, 'deal_fully_returned', 'selling', 'devolucao', 'trigger', now(),
              jsonb_build_object('client_id', v_client_id));

      IF v_client_id IS NOT NULL THEN
        PERFORM public.reverse_client_to_lead(v_client_id, COALESCE(NEW.return_reason, 'Devolução total'), v_deal_id);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_item_returned ON public.quote_items;
DROP TRIGGER IF EXISTS trg_item_returned_before ON public.quote_items;

CREATE TRIGGER trg_item_returned_before
BEFORE UPDATE OF return_status ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_item_returned_before();

CREATE TRIGGER trg_item_returned_after
AFTER UPDATE OF return_status ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_item_returned();