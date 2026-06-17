DROP TRIGGER IF EXISTS trg_quotes_validate_utilization ON public.quotes;
DROP FUNCTION IF EXISTS public.validate_utilization_on_close();