
DROP VIEW IF EXISTS public.deal_stage_metrics;

CREATE VIEW public.deal_stage_metrics
WITH (security_invoker = true) AS
SELECT
  deal_id,
  phase,
  stage,
  COUNT(*) AS passages,
  SUM(COALESCE(duration_seconds, EXTRACT(EPOCH FROM (now() - entered_at))::INTEGER)) AS total_seconds,
  MIN(entered_at) AS first_entered_at,
  MAX(entered_at) AS last_entered_at,
  MAX(exited_at) FILTER (WHERE exited_at IS NOT NULL) AS last_exited_at,
  BOOL_OR(exited_at IS NULL) AS is_current
FROM public.deal_stage_history
GROUP BY deal_id, phase, stage;

GRANT SELECT ON public.deal_stage_metrics TO authenticated, service_role;
