-- =============================================================================
-- MIGRATION 038: adiciona feature_type em ai_usage_log
--
-- ALTER aditivo — adiciona coluna nullable sem tocar em dados existentes.
-- Rows anteriores (histórico do posso-comprar-ia) ficam com feature_type = NULL,
-- que é tratado como 'posso_comprar' em todas as contagens.
--
-- feature_type:
--   NULL           — legado; equivale a 'posso_comprar' (antes desta migration)
--   'posso_comprar' — consultas do "Posso Comprar? com IA"
--   'assistente'    — mensagens enviadas no chat do Assistente Financeiro
--   'proativa'      — mensagens automáticas do sistema (Fase 3, ainda não ativo)
--
-- Renovação mensal: calculada dinamicamente (mes_referencia = mês corrente).
-- Não é necessário pg_cron — o pool renova automaticamente na virada do mês.
-- =============================================================================

ALTER TABLE ai_usage_log
  ADD COLUMN IF NOT EXISTS feature_type TEXT
    CHECK (feature_type IN ('posso_comprar', 'assistente', 'proativa'));

-- Índice composto para breakdown por tipo (tela de configurações)
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature_type
  ON ai_usage_log(user_id, mes_referencia, feature_type);
