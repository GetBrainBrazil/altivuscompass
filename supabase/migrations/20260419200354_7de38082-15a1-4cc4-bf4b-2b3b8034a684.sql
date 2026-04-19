-- =============================================================================
-- Corrige exposição de token JWT na migration 20260419185819_*.sql
-- =============================================================================
-- Contexto: a migration anterior gravou o anon JWT hardcoded dentro do
-- cron.schedule. Como migrations são versionadas no Git, o token vazou.
-- Esta migration reagenda o cron lendo a service_role_key do Vault do
-- Supabase em tempo de execução, sem expor segredos no código.
--
-- Escolha de abordagem: Vault nativo do Supabase (extensão supabase_vault).
-- Motivo: é gerenciado via painel/SQL Editor, não exige ALTER DATABASE
-- (que é bloqueado pela plataforma) e os valores são criptografados em repouso.
-- =============================================================================

-- Garante extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- Cria placeholder do segredo no Vault se ainda não existir.
-- O VALOR REAL deve ser preenchido manualmente após a migration (ver instruções).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    PERFORM vault.create_secret(
      'PLACEHOLDER_REPLACE_VIA_SQL_EDITOR',
      'service_role_key',
      'Service role key usada pelos cron jobs para chamar edge functions'
    );
  END IF;
END $$;

-- Remove o agendamento anterior (que carregava o token exposto)
DO $$ BEGIN
  PERFORM cron.unschedule('check-quote-validity-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Reagenda lendo o token do Vault em tempo de execução.
-- A função check-quote-validity ainda não existe; o cron vai falhar
-- silenciosamente até ela ser criada — comportamento esperado por ora.
SELECT cron.schedule(
  'check-quote-validity-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fuaaackbubqxkkdvbvpi.supabase.co/functions/v1/check-quote-validity',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'service_role_key'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);