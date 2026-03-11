-- =============================================================================
-- MIGRATION 036: assistente_mensagens
-- Histórico persistente do chat do Assistente Financeiro.
--
-- Escopo: por family_id — todos os membros da família (ex: casal) compartilham
-- o mesmo histórico de conversa.
--
-- role: 'user'      — mensagem enviada pelo usuário
--       'assistant' — resposta gerada pela IA
--
-- tone: tom de personalidade usado naquela resposta (salvo junto à mensagem
-- da IA para fins de exibição correta no histórico).
-- =============================================================================

CREATE TABLE IF NOT EXISTS assistente_mensagens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  conteudo    TEXT NOT NULL,
  tone        TEXT CHECK (tone IN ('conservador', 'parceiro', 'provocador', 'hype')),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice principal: família + ordem cronológica (leitura do histórico)
CREATE INDEX IF NOT EXISTS idx_assistente_mensagens_family_created
  ON assistente_mensagens(family_id, created_at DESC);

-- Índice secundário: autor da mensagem
CREATE INDEX IF NOT EXISTS idx_assistente_mensagens_user
  ON assistente_mensagens(user_id);

-- RLS: membros da família leem e escrevem no histórico compartilhado
ALTER TABLE assistente_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assistente_mensagens: membros da família leem o histórico"
  ON assistente_mensagens FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "assistente_mensagens: usuário insere para sua família"
  ON assistente_mensagens FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Service role pode tudo (Edge Function salva as mensagens da IA)
CREATE POLICY "assistente_mensagens: service role tem acesso total"
  ON assistente_mensagens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT ON assistente_mensagens TO authenticated;
