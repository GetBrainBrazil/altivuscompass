CREATE OR REPLACE FUNCTION public.generate_fulfillment_tasks(_deal_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _quote_id uuid;
  _client_id uuid;
  _created integer := 0;
  _item RECORD;
  _task JSONB;
  _task_key text;
  _full_title text;
  _due date;
  _offset int;
BEGIN
  SELECT d.source_quote_id, q.client_id
    INTO _quote_id, _client_id
  FROM public.deals d
  JOIN public.quotes q ON q.id = d.source_quote_id
  WHERE d.id = _deal_id;

  IF _quote_id IS NULL THEN
    RETURN 0;
  END IF;

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
                   THEN (_item.utilization_start + (_offset || ' days')::interval)::date
                   ELSE NULL END;

      IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE quote_item_id = _item.id
          AND description LIKE 'postsale:' || _task_key || E'\n%'
      ) THEN
        BEGIN
          INSERT INTO public.tasks (
            title, description, status, priority,
            quote_id, quote_item_id, client_id, due_date
          ) VALUES (
            _full_title,
            'postsale:' || _task_key || E'\nGerada automaticamente ao entrar em pós-venda.',
            'pending', 'medium',
            _quote_id, _item.id, _client_id, _due
          );
          _created := _created + 1;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'generate_fulfillment_tasks: falha ao inserir task para item % (%)', _item.id, SQLERRM;
        END;
      END IF;
    END LOOP;
  END LOOP;

  RETURN _created;
END;
$$;