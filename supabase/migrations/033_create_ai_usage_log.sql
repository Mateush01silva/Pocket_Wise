-- =============================================================================
-- MIGRATION 033: ai_usage_log
-- Registra cada interação com a IA para controle do limite de 30/mês.
-- Inserção feita exclusivamente via service role (Edge Function),
-- impedindo manipulação pelo cliente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes_referencia  TEXT NOT NULL,  -- formato: 'YYYY-MM'
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice composto para a query de contagem mensal (executada a cada chamada)
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_mes
  ON ai_usage_log(user_id, mes_referencia);

-- RLS: usuário lê apenas os próprios registros (para exibir contador na UI)
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_log: usuário lê os próprios registros"
  ON ai_usage_log FOR SELECT
  USING (auth.uid() = user_id);

-- Inserção e deleção apenas via service role
CREATE POLICY "ai_usage_log: service role tem acesso total"
  ON ai_usage_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
