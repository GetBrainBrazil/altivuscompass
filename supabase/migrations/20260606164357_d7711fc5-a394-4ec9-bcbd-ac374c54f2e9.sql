
CREATE OR REPLACE FUNCTION public.merge_contact_into_client(
  orphan_id uuid,
  client_contact_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orphan public.contacts%ROWTYPE;
  v_target public.contacts%ROWTYPE;
  v_lead_to_keep uuid;
BEGIN
  IF orphan_id = client_contact_id THEN
    RETURN;
  END IF;

  SELECT * INTO v_orphan FROM public.contacts WHERE id = orphan_id;
  SELECT * INTO v_target FROM public.contacts WHERE id = client_contact_id;
  IF v_orphan.id IS NULL OR v_target.id IS NULL THEN
    RETURN;
  END IF;

  v_lead_to_keep := COALESCE(v_target.lead_id, v_orphan.lead_id);

  -- Detach lead from orphan first to satisfy contacts_unique_lead
  IF v_orphan.lead_id IS NOT NULL THEN
    UPDATE public.contacts SET lead_id = NULL WHERE id = orphan_id;
  END IF;

  -- Re-point wa_conversations
  UPDATE public.wa_conversations
     SET contact_id = client_contact_id,
         client_id  = COALESCE(client_id, v_target.client_id),
         lead_id    = COALESCE(lead_id, v_lead_to_keep)
   WHERE contact_id = orphan_id;

  -- Promote target
  UPDATE public.contacts
     SET phone            = COALESCE(NULLIF(phone, ''), v_orphan.phone),
         email            = COALESCE(NULLIF(email, ''), v_orphan.email),
         full_name        = COALESCE(NULLIF(full_name, ''), v_orphan.full_name),
         first_contact_at = LEAST(
           COALESCE(first_contact_at, v_orphan.first_contact_at, now()),
           COALESCE(v_orphan.first_contact_at, first_contact_at, now())
         ),
         last_contact_at  = GREATEST(
           COALESCE(last_contact_at, v_orphan.last_contact_at, now()),
           COALESCE(v_orphan.last_contact_at, last_contact_at, now())
         ),
         is_returning     = COALESCE(v_target.is_returning, false) OR COALESCE(v_orphan.is_returning, false),
         lead_id          = v_lead_to_keep,
         level            = 'cliente',
         promoted_to_cliente_at = COALESCE(v_target.promoted_to_cliente_at, now()),
         updated_at       = now()
   WHERE id = client_contact_id;

  DELETE FROM public.contacts WHERE id = orphan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_contact_into_client(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_contact_into_client(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_contact_from_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_contact_id UUID;
  v_orphan_id UUID;
  v_tail TEXT;
BEGIN
  SELECT id INTO v_existing_contact_id
    FROM public.contacts WHERE client_id = NEW.id LIMIT 1;

  IF v_existing_contact_id IS NOT NULL THEN
    UPDATE public.contacts
       SET full_name = NEW.full_name,
           phone     = COALESCE(NEW.phone, phone),
           email     = COALESCE(NEW.email, email),
           level     = 'cliente',
           promoted_to_cliente_at = COALESCE(promoted_to_cliente_at, now())
     WHERE id = v_existing_contact_id;

    v_tail := right(regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g'), 9);
    IF length(v_tail) >= 8 THEN
      FOR v_orphan_id IN
        SELECT c.id FROM public.contacts c
         WHERE c.client_id IS NULL
           AND c.id <> v_existing_contact_id
           AND right(regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g'), 9) = v_tail
      LOOP
        PERFORM public.merge_contact_into_client(v_orphan_id, v_existing_contact_id);
      END LOOP;
    END IF;
    FOR v_orphan_id IN
      SELECT DISTINCT c.id FROM public.contacts c
       JOIN public.client_phones cp ON cp.client_id = NEW.id
       WHERE c.client_id IS NULL
         AND c.id <> v_existing_contact_id
         AND length(regexp_replace(COALESCE(cp.phone, ''), '\D', '', 'g')) >= 8
         AND right(regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g'), 9)
           = right(regexp_replace(COALESCE(cp.phone, ''), '\D', '', 'g'), 9)
    LOOP
      PERFORM public.merge_contact_into_client(v_orphan_id, v_existing_contact_id);
    END LOOP;
    RETURN NEW;
  END IF;

  v_tail := right(regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g'), 9);
  IF length(v_tail) >= 8 THEN
    SELECT c.id INTO v_existing_contact_id
      FROM public.contacts c
     WHERE c.client_id IS NULL
       AND right(regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g'), 9) = v_tail
     ORDER BY c.created_at ASC
     LIMIT 1;
  END IF;

  IF v_existing_contact_id IS NULL THEN
    SELECT c.id INTO v_existing_contact_id
      FROM public.contacts c
      JOIN public.client_phones cp ON cp.client_id = NEW.id
     WHERE c.client_id IS NULL
       AND length(regexp_replace(COALESCE(cp.phone, ''), '\D', '', 'g')) >= 8
       AND right(regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g'), 9)
         = right(regexp_replace(COALESCE(cp.phone, ''), '\D', '', 'g'), 9)
     ORDER BY c.created_at ASC
     LIMIT 1;
  END IF;

  IF v_existing_contact_id IS NOT NULL THEN
    UPDATE public.contacts
       SET client_id = NEW.id,
           full_name = COALESCE(NULLIF(NEW.full_name, ''), full_name),
           phone     = COALESCE(NEW.phone, phone),
           email     = COALESCE(NEW.email, email),
           level     = 'cliente',
           promoted_to_cliente_at = COALESCE(promoted_to_cliente_at, now()),
           updated_at = now()
     WHERE id = v_existing_contact_id;
  ELSE
    INSERT INTO public.contacts (level, full_name, phone, email, client_id, source, promoted_to_cliente_at)
    VALUES ('cliente', NEW.full_name, NEW.phone, NEW.email, NEW.id, 'manual', now());
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r RECORD;
  v_orphan_id UUID;
  v_tail TEXT;
BEGIN
  FOR r IN
    SELECT c.id AS target_id, c.client_id, c.phone AS target_phone
      FROM public.contacts c
     WHERE c.client_id IS NOT NULL
  LOOP
    FOR v_tail IN
      SELECT DISTINCT right(regexp_replace(COALESCE(p, ''), '\D', '', 'g'), 9) AS t
        FROM (
          SELECT r.target_phone AS p
          UNION ALL
          SELECT cl.phone FROM public.clients cl WHERE cl.id = r.client_id
          UNION ALL
          SELECT cp.phone FROM public.client_phones cp WHERE cp.client_id = r.client_id
        ) t
       WHERE length(regexp_replace(COALESCE(p, ''), '\D', '', 'g')) >= 8
    LOOP
      FOR v_orphan_id IN
        SELECT c2.id FROM public.contacts c2
         WHERE c2.client_id IS NULL
           AND c2.id <> r.target_id
           AND right(regexp_replace(COALESCE(c2.phone, ''), '\D', '', 'g'), 9) = v_tail
      LOOP
        PERFORM public.merge_contact_into_client(v_orphan_id, r.target_id);
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
