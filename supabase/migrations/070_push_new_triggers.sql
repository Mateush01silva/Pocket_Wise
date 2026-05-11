-- =============================================================================
-- MIGRATION 070: Novos gatilhos de push — janela noturna + CTAs Explorador
-- =============================================================================
--
-- Adiciona colunas de preferência para:
--   - no_transactions_today   : lembrete noturno de registrar gastos (opt-in)
--   - weekly_summary          : resumo semanal toda segunda-feira
--   - weekend_budget          : orçamento de fim de semana toda sexta-feira
--   - cta_upgrade             : CTAs de conversão para usuários Explorador
--
-- Novos cron jobs necessários (criar via Dashboard → Database → Cron Jobs):
--
--   1. pocketwise-notify-evening-push
--      Schedule: 0 23 * * *  (23:00 UTC = 20:00 BRT)
--      URL: POST https://[PROJECT_ID].supabase.co/functions/v1/notify-daily-push
--      Body: {"window":"evening"}
--      Headers: {"x-cron-secret": "[CRON_SECRET]"}
--
--   2. pocketwise-notify-cta-push
--      Schedule: 0 15 * * *  (15:00 UTC = 12:00 BRT)
--      URL: POST https://[PROJECT_ID].supabase.co/functions/v1/notify-cta-push
--      Headers: {"x-cron-secret": "[CRON_SECRET]"}
-- =============================================================================

ALTER TABLE push_notification_preferences
  ADD COLUMN IF NOT EXISTS no_transactions_today BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS weekly_summary         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS weekend_budget         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS cta_upgrade            BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN push_notification_preferences.no_transactions_today IS
  'Lembrete às 20h quando nenhum lançamento foi registrado no dia (opt-in)';
COMMENT ON COLUMN push_notification_preferences.weekly_summary IS
  'Resumo financeiro toda segunda-feira às 20h';
COMMENT ON COLUMN push_notification_preferences.weekend_budget IS
  'Quanto resta no envelope de lazer, toda sexta às 20h';
COMMENT ON COLUMN push_notification_preferences.cta_upgrade IS
  'Notificações de CTA para upgrade de plano (apenas usuários Explorador)';

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'MIGRATION 070 executada.';
  RAISE NOTICE '';
  RAISE NOTICE 'AÇÃO NECESSÁRIA: criar 2 novos cron jobs no Supabase Dashboard';
  RAISE NOTICE '(Database → Cron Jobs → Create new job)';
  RAISE NOTICE '';
  RAISE NOTICE '1. Nome: pocketwise-notify-evening-push';
  RAISE NOTICE '   Schedule: 0 23 * * *  (20:00 BRT)';
  RAISE NOTICE '   URL: POST /functions/v1/notify-daily-push';
  RAISE NOTICE '   Body: {"window":"evening"}';
  RAISE NOTICE '   Headers: {"x-cron-secret": "[CRON_SECRET]"}';
  RAISE NOTICE '';
  RAISE NOTICE '2. Nome: pocketwise-notify-cta-push';
  RAISE NOTICE '   Schedule: 0 15 * * *  (12:00 BRT)';
  RAISE NOTICE '   URL: POST /functions/v1/notify-cta-push';
  RAISE NOTICE '   Headers: {"x-cron-secret": "[CRON_SECRET]"}';
  RAISE NOTICE '=================================================================';
END;
$$;
