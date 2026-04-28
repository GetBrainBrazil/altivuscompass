-- Corrige trigger para nunca sobrescrever full_name do contato com um valor pior
-- (telefone, vazio, ou placeholder) quando o lead vinculado é atualizado.

CREATE OR REPLACE FUNCTION public.sync_contact_from_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_travel_data BOOLEAN;
  v_target_level public.contact_level;
  v_existing_contact_id UUID;
  v_existing_level public.contact_level;
  v_existing_name TEXT;
  v_new_name TEXT;
  v_final_name TEXT;
  v_existing_is_placeholder BOOLEAN;
  v_new_is_placeholder BOOLEAN;
BEGIN
  v_has_travel_data :=
    NEW.destination IS NOT NULL
    AND (NEW.travel_date_start IS NOT NULL OR NEW.travel_date_end IS NOT NULL OR NEW.flexible_dates = true)
    AND NEW.travelers_count IS NOT NULL;

  v_target_level := CASE WHEN v_has_travel_data THEN 'lead'::contact_level ELSE 'prospect'::contact_level END;

  SELECT id, level, full_name INTO v_existing_contact_id, v_existing_level, v_existing_name
  FROM public.contacts WHERE lead_id = NEW.id LIMIT 1;

  IF v_existing_contact_id IS NULL THEN
    IF NEW.converted_client_id IS NOT NULL THEN
      SELECT id, level, full_name INTO v_existing_contact_id, v_existing_level, v_existing_name
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
      RETURN NEW;
    END IF;
  END IF;

  -- Decide o melhor nome: nunca regride para placeholder/telefone/vazio
  v_new_name := COALESCE(NULLIF(TRIM(NEW.full_name), ''), NULL);
  v_existing_is_placeholder := v_existing_name IS NULL
    OR TRIM(v_existing_name) = ''
    OR v_existing_name ~ '^\+?\d'  -- começa com dígito ou +
    OR v_existing_name ~* '^contato\s+\d'
    OR v_existing_name !~ '[A-Za-zÀ-ÿ]';  -- sem letras
  v_new_is_placeholder := v_new_name IS NULL
    OR v_new_name ~ '^\+?\d'
    OR v_new_name ~* '^contato\s+\d'
    OR v_new_name !~ '[A-Za-zÀ-ÿ]';

  IF v_existing_is_placeholder AND NOT v_new_is_placeholder THEN
    v_final_name := v_new_name;
  ELSIF NOT v_existing_is_placeholder THEN
    -- Nome existente é real: NUNCA sobrescrever
    v_final_name := v_existing_name;
  ELSE
    -- Ambos placeholder: mantém o existente se houver, senão usa o novo
    v_final_name := COALESCE(v_existing_name, v_new_name);
  END IF;

  IF v_existing_level = 'cliente' THEN
    UPDATE public.contacts
    SET full_name = v_final_name,
        phone = COALESCE(NEW.phone, phone),
        email = COALESCE(NEW.email, email)
    WHERE id = v_existing_contact_id;
  ELSE
    UPDATE public.contacts
    SET full_name = v_final_name,
        phone = COALESCE(NEW.phone, phone),
        email = COALESCE(NEW.email, email),
        level = v_target_level,
        promoted_to_lead_at = CASE
          WHEN v_target_level = 'lead' AND promoted_to_lead_at IS NULL THEN now()
          ELSE promoted_to_lead_at
        END
    WHERE id = v_existing_contact_id;
  END IF;

  RETURN NEW;
END;
$function$;