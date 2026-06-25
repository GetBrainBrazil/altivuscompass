
-- Ensure scheduler extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cleanup function: remove audit log entries older than 6 months
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < now() - INTERVAL '6 months';
END;
$$;

-- Schedule it daily at 03:00 UTC (idempotent: drop existing schedule first)
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'cleanup_old_audit_logs_daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'cleanup_old_audit_logs_daily',
    '0 3 * * *',
    $cron$ SELECT public.cleanup_old_audit_logs(); $cron$
  );
END;
$$;
