-- =============================================================================
-- MIGRATION 039: ai_credits_config
-- Configuração de alocação de créditos de IA por usuário.
--
-- Pool total: 30 créditos/mês (hardcoded nas Edge Functions).
-- creditos_proativas: quanto desse pool o usuário reserva para mensagens
-- automáticas do sistema (Fase 3). O restante (30 - creditos_proativas)
-- fica disponível para consultas manuais ("Posso Comprar?" + chat).
--
-- Enforcement:
--   limite_manual  = 30 - creditos_proativas
--   limite_proativas = creditos_proativas  (verificado na Fase 3)
--
-- Criação do registro: feita pelo usuário ao salvar a configuração via
-- Settings. Antes disso, as Edge Functions assumem DEFAULT de 10 proativas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_credits_config (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creditos_proativas  INT  NOT NULL DEFAULT 10
                        CHECK (creditos_proativas BETWEEN 0 AND 30),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Um registro por usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_credits_config_user_id
  ON ai_credits_config(user_id);

-- RLS: usuário gerencia o próprio registro
ALTER TABLE ai_credits_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_credits_config: usuário gerencia o próprio registro"
  ON ai_credits_config FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role: Edge Functions leem o config para calcular o limite efetivo
CREATE POLICY "ai_credits_config: service role tem acesso total"
  ON ai_credits_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON ai_credits_config TO authenticated;
