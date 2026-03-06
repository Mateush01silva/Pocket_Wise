-- =============================================================================
-- MIGRATION 034: user_ai_preferences
-- Armazena a preferência de tom de personalidade da IA por usuário.
-- Tabela separada para não tocar na tabela users existente.
--
-- Tons disponíveis:
--   'conservador' — cauteloso, foca nos riscos
--   'parceiro'    — honesto e direto, sem drama (padrão)
--   'provocador'  — desafia a poupar, irônico
--   'hype'        — torce por você, mas mostra os números
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_ai_preferences (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personality_tone  TEXT NOT NULL DEFAULT 'parceiro'
                      CHECK (personality_tone IN ('conservador', 'parceiro', 'provocador', 'hype')),
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Um registro por usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id
  ON user_ai_preferences(user_id);

-- RLS: usuário gerencia o próprio registro
ALTER TABLE user_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_ai_preferences: usuário gerencia o próprio registro"
  ON user_ai_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role pode tudo (Edge Function lê o tom para montar o prompt)
CREATE POLICY "user_ai_preferences: service role tem acesso total"
  ON user_ai_preferences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
