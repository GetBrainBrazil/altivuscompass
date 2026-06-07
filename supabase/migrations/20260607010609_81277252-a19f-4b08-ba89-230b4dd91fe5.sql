CREATE OR REPLACE FUNCTION public._smoke_etapa6_set_fulfilling(_deal_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.deals SET phase='fulfilling', stage='fulfilling' WHERE id=_deal_id;
END $$;
GRANT EXECUTE ON FUNCTION public._smoke_etapa6_set_fulfilling(uuid) TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION public._smoke_etapa6_reset_phase(_deal_id uuid, _phase deal_phase)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.deals SET phase=_phase WHERE id=_deal_id;
END $$;
GRANT EXECUTE ON FUNCTION public._smoke_etapa6_reset_phase(uuid, deal_phase) TO authenticated, service_role, anon;