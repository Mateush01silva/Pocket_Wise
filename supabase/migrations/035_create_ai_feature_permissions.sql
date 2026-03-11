-- =============================================================================
-- MIGRATION 035: ai_feature_permissions
-- Controle granular de acesso por funcionalidade de IA.
-- Relaciona-se com ai_feature_access (master flag: se enabled=false ali,
-- nenhuma funcionalidade de IA funciona, independentemente desta tabela).
--
-- feature_key possíveis:
--   'posso_comprar' — funcionalidade "Posso Comprar? com IA"
--   'assistente'    — Assistente Financeiro (chat persistente)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_feature_permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  access_id   UUID NOT NULL REFERENCES ai_feature_access(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL CHECK (feature_key IN ('posso_comprar', 'assistente')),
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT uq_access_feature UNIQUE (access_id, feature_key)
);

-- Índice para lookup rápido (access_id + feature_key)
CREATE INDEX IF NOT EXISTS idx_ai_feature_permissions_lookup
  ON ai_feature_permissions(access_id, feature_key);

-- RLS: service role gerencia; usuários não têm acesso direto
-- (acesso verificado exclusivamente via Edge Functions com service role)
ALTER TABLE ai_feature_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_feature_permissions: service role tem acesso total"
  ON ai_feature_permissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
