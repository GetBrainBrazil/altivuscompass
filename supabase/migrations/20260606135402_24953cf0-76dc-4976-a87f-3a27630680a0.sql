
CREATE OR REPLACE FUNCTION public.promote_contact_on_quote_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.contacts
  SET level = 'lead'::contact_level,
      promoted_to_lead_at = COALESCE(promoted_to_lead_at, now())
  WHERE lead_id = NEW.lead_id
    AND level = 'prospect'::contact_level;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_promote_contact_on_quote_created ON public.quotes;
CREATE TRIGGER trg_promote_contact_on_quote_created
AFTER INSERT ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.promote_contact_on_quote_created();
