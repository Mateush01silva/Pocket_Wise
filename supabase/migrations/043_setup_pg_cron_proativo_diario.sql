-- =============================================================================
-- MIGRATION 043: pg_cron job para análise proativa diária
-- =============================================================================
--
-- Agenda a Edge Function `ai-proativo-diario` para rodar diariamente às 08:00 UTC.
--
-- PRÉ-REQUISITOS:
--   1. Extensão pg_cron habilitada no projeto Supabase
--      (Dashboard → Database → Extensions → cron)
--   2. Extensão pg_net habilitada (para chamadas HTTP)
--      (Dashboard → Database → Extensions → pg_net)
--   3. Variável de ambiente CRON_SECRET configurada nas Edge Functions
--      (Dashboard → Edge Functions → Secrets)
--   4. URL do projeto Supabase disponível em app.settings.app_url
--      ou substituída manualmente abaixo.
--
-- PARA SUBSTITUIR A URL MANUALMENTE, troque:
--   current_setting('app.settings.supabase_url', true)
-- por:
--   'https://[SEU_PROJECT_ID].supabase.co'
-- =============================================================================

-- Garante que as extensões necessárias estão disponíveis
-- (em projetos Supabase Pro/Team, pg_cron já está disponível)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job existente se houver (idempotente)
SELECT cron.unschedule('pocketwise-ai-proativo-diario')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'pocketwise-ai-proativo-diario'
);

-- Agenda o job diário às 08:00 UTC
-- O CRON_SECRET deve estar configurado em:
--   Supabase Dashboard → Edge Functions → Manage secrets → CRON_SECRET
--
-- ATENÇÃO: Substitua os dois placeholders abaixo antes de executar:
--   [SEU_PROJECT_ID]  → ID do seu projeto Supabase (ex: abcdefghijklmnop)
--   [SEU_CRON_SECRET] → Valor do secret CRON_SECRET definido nas Edge Functions
--
-- Exemplo de agendamento manual via Dashboard:
--   Schedule:  0 8 * * *
--   HTTP POST: https://[SEU_PROJECT_ID].supabase.co/functions/v1/ai-proativo-diario
--   Headers:   {"x-cron-secret": "[SEU_CRON_SECRET]"}

-- Descomente e preencha os valores abaixo para executar via SQL:
/*
SELECT cron.schedule(
  'pocketwise-ai-proativo-diario',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url    := 'https://[SEU_PROJECT_ID].supabase.co/functions/v1/ai-proativo-diario',
      body   := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', '[SEU_CRON_SECRET]'
      )
    );
  $$
);
*/

-- Confirmação de instrução para deploy manual
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'MIGRATION 043 executada.';
  RAISE NOTICE '';
  RAISE NOTICE 'Para ativar o job diário de análise proativa, escolha uma opção:';
  RAISE NOTICE '';
  RAISE NOTICE 'OPÇÃO A — Supabase Dashboard:';
  RAISE NOTICE '  1. Acesse: Database → Cron Jobs → Create new job';
  RAISE NOTICE '  2. Name:     pocketwise-ai-proativo-diario';
  RAISE NOTICE '  3. Schedule: 0 8 * * *  (diário às 08:00 UTC)';
  RAISE NOTICE '  4. Type:     HTTP Request';
  RAISE NOTICE '  5. URL:      POST https://[SEU_PROJECT_ID].supabase.co/functions/v1/ai-proativo-diario';
  RAISE NOTICE '  6. Headers:  {"x-cron-secret": "[VALOR_DO_CRON_SECRET]"}';
  RAISE NOTICE '';
  RAISE NOTICE 'OPÇÃO B — SQL Editor:';
  RAISE NOTICE '  Descomente o bloco SELECT cron.schedule(...) nesta migration,';
  RAISE NOTICE '  preencha SEU_PROJECT_ID e SEU_CRON_SECRET, e execute.';
  RAISE NOTICE '';
  RAISE NOTICE 'O CRON_SECRET está em: Dashboard → Edge Functions → Secrets';
  RAISE NOTICE '=================================================================';
END;
$$;
