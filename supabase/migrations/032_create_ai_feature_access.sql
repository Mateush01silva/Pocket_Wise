-- =============================================================================
-- MIGRATION 032: ai_feature_access
-- Controla quais usuários têm acesso à feature "Posso Comprar? com IA"
--
-- COMO HABILITAR NOVOS USUÁRIOS (sem alterar código):
--   INSERT INTO ai_feature_access (email, enabled)
--   VALUES ('novo@email.com', true)
--   ON CONFLICT (email) DO NOTHING;
--
-- O user_id é preenchido automaticamente pela Edge Function no primeiro acesso.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_feature_access (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para lookup rápido
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_feature_access_user_id
  ON ai_feature_access(user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_feature_access_email
  ON ai_feature_access(email);

-- RLS: cada usuário só lê o próprio registro
ALTER TABLE ai_feature_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_feature_access: usuário lê o próprio registro"
  ON ai_feature_access FOR SELECT
  USING (auth.uid() = user_id);

-- Service role pode tudo (necessário para a Edge Function com service key)
CREATE POLICY "ai_feature_access: service role tem acesso total"
  ON ai_feature_access FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- SEED: habilitar o usuário inicial
-- user_id é nulo intencionalmente — a Edge Function fará o vínculo
-- automaticamente no primeiro acesso via lookup por email.
-- =============================================================================
INSERT INTO ai_feature_access (email, enabled)
VALUES ('silva.mateush01@gmail.com', true)
ON CONFLICT (email) DO NOTHING;
