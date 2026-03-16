-- =============================================================================
-- MIGRATION 045: adiciona 'verificar_fatura' ao CHECK de feature_type
--
-- A migration 038 criou a coluna feature_type com CHECK restrito a
-- ('posso_comprar', 'assistente', 'proativa'). O valor 'verificar_fatura'
-- não estava na lista, causando falha silenciosa em todos os registros de
-- uso da funcionalidade "Verificar Fatura com PDF/Excel".
--
-- Solução: recriar o constraint incluindo 'verificar_fatura'.
-- =============================================================================

-- Remover constraint existente (nome gerado automaticamente pelo Postgres)
ALTER TABLE ai_usage_log
  DROP CONSTRAINT IF EXISTS ai_usage_log_feature_type_check;

-- Recriar com o valor adicional
ALTER TABLE ai_usage_log
  ADD CONSTRAINT ai_usage_log_feature_type_check
    CHECK (feature_type IN ('posso_comprar', 'assistente', 'proativa', 'verificar_fatura'));
