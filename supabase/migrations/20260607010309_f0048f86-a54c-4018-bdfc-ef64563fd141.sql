-- Etapa 6 — geração de tarefas de pós-venda quando deal entra em fulfilling.
-- IDENTIFICAÇÃO no painel: title com prefixo '[Pós-venda]' + quote_item_id setado.
-- Idempotente: por (quote_item_id, task_key) armazenado como prefixo no title.
-- Mapa abaixo é cópia espelho do src/lib/item-types.ts (TS é fonte da verdade).
-- Não modifica módulo de tasks, não cria colunas, não toca edge accept-quote.

CREATE OR REPLACE FUNCTION public.generate_fulfillment_tasks(_deal_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quote_id uuid;
  _client_id uuid;
  _contact_id uuid;
  _created integer := 0;
  _item RECORD;
  _task JSONB;
  _task_key text;
  _full_title text;
  _due date;
  _offset int;
BEGIN
  -- Resolve quote do deal
  SELECT d.quote_id, q.client_id, q.contact_id
    INTO _quote_id, _client_id, _contact_id
  FROM public.deals d
  JOIN public.quotes q ON q.id = d.quote_id
  WHERE d.id = _deal_id;

  IF _quote_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Mapa de templates por tipo (espelho de src/lib/item-types.ts)
  FOR _item IN
    SELECT id, item_type, title, utilization_start
    FROM public.quote_items
    WHERE quote_id = _quote_id
      AND COALESCE(return_status, 'active') = 'active'
  LOOP
    FOR _task IN
      SELECT * FROM jsonb_array_elements(
        CASE _item.item_type
          WHEN 'flight' THEN '[
            {"key":"checkin_online","title":"Realizar check-in online","offset_days":-2},
            {"key":"confirmar_emissao","title":"Confirmar emissão do bilhete","offset_days":-7}
          ]'::jsonb
          WHEN 'hotel' THEN '[
            {"key":"confirmar_voucher","title":"Confirmar voucher do hotel","offset_days":-7},
            {"key":"instrucoes_checkin","title":"Enviar instruções de check-in ao cliente","offset_days":-3}
          ]'::jsonb
          WHEN 'transport' THEN '[
            {"key":"confirmar_voucher","title":"Confirmar voucher do transporte","offset_days":-3},
            {"key":"instrucoes_cliente","title":"Enviar instruções de embarque ao cliente","offset_days":-1}
          ]'::jsonb
          WHEN 'experience' THEN '[
            {"key":"confirmar_voucher","title":"Confirmar voucher da experiência","offset_days":-3},
            {"key":"lembrar_cliente","title":"Lembrar cliente do horário","offset_days":-1}
          ]'::jsonb
          WHEN 'other_service' THEN '[
            {"key":"confirmar_servico","title":"Confirmar prestação do serviço","offset_days":-3}
          ]'::jsonb
          ELSE '[]'::jsonb
        END
      )
    LOOP
      _task_key := _task->>'key';
      _offset := COALESCE((_task->>'offset_days')::int, 0);
      _full_title := '[Pós-venda] ' || (_task->>'title') ||
                     CASE WHEN _item.title IS NOT NULL AND _item.title <> ''
                          THEN ' — ' || _item.title ELSE '' END;
      _due := CASE WHEN _item.utilization_start IS NOT NULL
                   THEN _item.utilization_start + (_offset || ' days')::interval
                   ELSE NULL END;

      -- Idempotência: já existe tarefa para (quote_item_id, key)?
      IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE quote_item_id = _item.id
          AND description LIKE 'postsale:' || _task_key || E'\n%'
      ) THEN
        BEGIN
          INSERT INTO public.tasks (
            title, description, status, priority,
            quote_id, quote_item_id, client_id, contact_id, due_date
          ) VALUES (
            _full_title,
            'postsale:' || _task_key || E'\nGerada automaticamente ao entrar em pós-venda.',
            'pending', 'medium',
            _quote_id, _item.id, _client_id, _contact_id, _due
          );
          _created := _created + 1;
        EXCEPTION WHEN OTHERS THEN
          -- Não quebra a operação do deal (padrão Etapa 2/5)
          RAISE WARNING 'generate_fulfillment_tasks: falha ao inserir task para item % (%)', _item.id, SQLERRM;
        END;
      END IF;
    END LOOP;
  END LOOP;

  RETURN _created;
END;
$$;

-- Trigger: dispara quando deals.phase vira 'fulfilling'
CREATE OR REPLACE FUNCTION public.trg_deals_fulfilling_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phase = 'fulfilling'
     AND (TG_OP = 'INSERT' OR OLD.phase IS DISTINCT FROM 'fulfilling') THEN
    BEGIN
      PERFORM public.generate_fulfillment_tasks(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'trg_deals_fulfilling_tasks: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_fulfilling_tasks ON public.deals;
CREATE TRIGGER trg_deals_fulfilling_tasks
  AFTER INSERT OR UPDATE OF phase ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_deals_fulfilling_tasks();

GRANT EXECUTE ON FUNCTION public.generate_fulfillment_tasks(uuid) TO authenticated, service_role;