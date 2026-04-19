-- Campo de idempotência para o cron de validade
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS validity_warning_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_quotes_validity_warning
  ON public.quotes(quote_validity)
  WHERE validity_warning_sent_at IS NULL
    AND archived_at IS NULL
    AND is_template = false;

-- Extensões para cron + http
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job anterior se existir (evita duplicata em reruns)
DO $$ BEGIN
  PERFORM cron.unschedule('check-quote-validity-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agenda chamada diária às 12:00 UTC (9h Brasília)
SELECT cron.schedule(
  'check-quote-validity-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fuaaackbubqxkkdvbvpi.supabase.co/functions/v1/check-quote-validity',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YWFhY2tidWJxeGtrZHZidnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTE4NjEsImV4cCI6MjA4ODQ2Nzg2MX0.nJOjmB3zBnR_Jt_GBOOPEX9ym5GzugdjwXagHUu2ejw'
    ),
    body := '{}'::jsonb
  );
  $$
);