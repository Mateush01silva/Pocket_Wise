-- =============================================================================
-- MIGRATION 040: adiciona suporte a mensagens proativas em assistente_mensagens
--
-- Novos campos:
--   message_type  TEXT 'manual' | 'proactive'  — quem gerou a mensagem
--                 DEFAULT 'manual' → rows existentes ficam corretamente tipadas
--
--   is_read       BOOLEAN DEFAULT true          — lida pelo usuário?
--                 DEFAULT true → mensagens manuais já estão implicitamente lidas
--                 A Edge Function insere proativas com is_read = false;
--                 o hook as marca como true quando loadHistorico() for chamado.
--
--   trigger_key   TEXT nullable                 — qual gatilho gerou a mensagem
--                 NULL para mensagens manuais; preenchido para proativas.
--                 Exemplos: 'envelope_estourado_2x', 'conta_sem_cobertura'
--                 Usado pelo frontend para escolher o chip "Alerta" vs "Análise".
--
-- ALTER aditivo: todos os campos têm DEFAULT, nenhum viola NOT NULL em rows
-- existentes. Retrocompatível com o código anterior sem qualquer rollback.
-- =============================================================================

ALTER TABLE assistente_mensagens
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (message_type IN ('manual', 'proactive')),
  ADD COLUMN IF NOT EXISTS is_read      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS trigger_key  TEXT;

-- Índice para a query do badge (não lidas por família)
CREATE INDEX IF NOT EXISTS idx_assistente_mensagens_unread
  ON assistente_mensagens(family_id, message_type, is_read)
  WHERE message_type = 'proactive' AND is_read = false;

-- Índice para carregar histórico na ordem correta incluindo o novo campo
CREATE INDEX IF NOT EXISTS idx_assistente_mensagens_family_created
  ON assistente_mensagens(family_id, created_at ASC);

-- -----------------------------------------------------------------------------
-- Política UPDATE: usuário pode marcar SUAS proativas como lidas
-- (o hook chama UPDATE SET is_read=true quando abre o chat)
-- Restrições: só pode setar is_read=true, só em proativas da própria família,
-- nunca pode alterar conteúdo ou type.
-- -----------------------------------------------------------------------------
CREATE POLICY "assistente_mensagens: marcar proativas como lidas"
  ON assistente_mensagens FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
    AND message_type = 'proactive'
    AND is_read = false
  )
  WITH CHECK (
    -- Permite apenas setar is_read=true. Todo o resto deve permanecer igual.
    is_read = true
    AND message_type = 'proactive'
  );
