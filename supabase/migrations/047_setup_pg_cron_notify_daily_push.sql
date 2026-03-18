-- =============================================================================
-- MIGRATION 047: pg_cron job para notificações push diárias
-- =============================================================================
--
-- Agenda a Edge Function `notify-daily-push` para rodar diariamente às 08:00 UTC
-- (equivalente a 05:00 BRT ou 11:00 BRT dependendo do horário de verão).
--
-- A função verifica para cada usuário com subscription ativa:
--   - Envelopes estourados (cooldown 24h)
--   - Despesas vencidas (cooldown 24h)
--   - Cartão no limite ≥90% (cooldown 24h)
--   - Trial expirando em 3 dias (1× por trial)
--   - Trial expirando em 1 dia (1× por trial)
--   - Trial expirado há 1-2 dias — reengajamento (1× por trial)
--
-- PRÉ-REQUISITOS:
--   1. Extensão pg_cron habilitada (Dashboard → Database → Extensions → cron)
--   2. Extensão pg_net habilitada (Dashboard → Database → Extensions → pg_net)
--   3. CRON_SECRET configurado como Supabase Secret
--   4. VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT configurados como Supabase Secrets:
--        supabase secrets set VAPID_PUBLIC_KEY=<chave_publica>
--        supabase secrets set VAPID_PRIVATE_KEY=<chave_privada>
--        supabase secrets set VAPID_SUBJECT=mailto:suporte@pocketwise.app
--   5. Migration 046 (push_notifications tables) já executada
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Confirmação de instrução para deploy manual
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'MIGRATION 047 executada.';
  RAISE NOTICE '';
  RAISE NOTICE 'Para ativar o job de push notifications diário:';
  RAISE NOTICE '';
  RAISE NOTICE 'OPÇÃO A — Supabase Dashboard (recomendado):';
  RAISE NOTICE '  1. Acesse: Database → Cron Jobs → Create new job';
  RAISE NOTICE '  2. Name:     pocketwise-notify-daily-push';
  RAISE NOTICE '  3. Schedule: 0 11 * * *  (diário às 11:00 UTC = 08:00 BRT)';
  RAISE NOTICE '  4. Type:     HTTP Request';
  RAISE NOTICE '  5. URL:      POST https://[SEU_PROJECT_ID].supabase.co/functions/v1/notify-daily-push';
  RAISE NOTICE '  6. Headers:  {"x-cron-secret": "[VALOR_DO_CRON_SECRET]"}';
  RAISE NOTICE '';
  RAISE NOTICE 'OPÇÃO B — SQL abaixo (substituir placeholders antes de rodar):';
  RAISE NOTICE '';
  RAISE NOTICE '  SELECT cron.schedule(';
  RAISE NOTICE '    ''pocketwise-notify-daily-push'',';
  RAISE NOTICE '    ''0 11 * * *'',';
  RAISE NOTICE '    $job$';
  RAISE NOTICE '      SELECT net.http_post(';
  RAISE NOTICE '        url     := ''https://[SEU_PROJECT_ID].supabase.co/functions/v1/notify-daily-push'',';
  RAISE NOTICE '        body    := ''{}''::jsonb,';
  RAISE NOTICE '        headers := jsonb_build_object(';
  RAISE NOTICE '          ''Content-Type'',  ''application/json'',';
  RAISE NOTICE '          ''x-cron-secret'', ''[SEU_CRON_SECRET]''';
  RAISE NOTICE '        )';
  RAISE NOTICE '      );';
  RAISE NOTICE '    $job$';
  RAISE NOTICE '  );';
  RAISE NOTICE '';
  RAISE NOTICE 'VAPID Secrets necessários (configurar via supabase secrets set):';
  RAISE NOTICE '  VAPID_PUBLIC_KEY   → chave pública gerada com npx web-push generate-vapid-keys';
  RAISE NOTICE '  VAPID_PRIVATE_KEY  → chave privada (nunca expor no frontend!)';
  RAISE NOTICE '  VAPID_SUBJECT      → mailto:suporte@pocketwise.app';
  RAISE NOTICE '';
  RAISE NOTICE 'Frontend — adicionar ao .env.local e Vercel:';
  RAISE NOTICE '  VITE_VAPID_PUBLIC_KEY=<mesma chave pública>';
  RAISE NOTICE '=================================================================';
END;
$$;
