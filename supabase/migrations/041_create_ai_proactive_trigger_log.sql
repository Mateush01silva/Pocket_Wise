-- =============================================================================
-- MIGRATION 041: ai_proactive_trigger_log
-- Controla o cooldown de 7 dias por gatilho e rastreia todas as mensagens
-- proativas geradas, vinculando gatilho → mensagem no chat.
--
-- trigger_key:
--   Para gatilhos globais:
--     'sem_lancamentos_7dias'       — 7 dias sem nenhum lançamento
--     'desequilibrio_casal_2x'      — gasto 2x maior entre membros do casal
--     'fechamento_todos_envelopes_ok' — mês anterior fechou no azul
--     'resumo_mensal'               — resumo mensal (dispara todo dia 1)
--   Para gatilhos por entidade (ID no sufixo):
--     'envelope_estourado_2x_{categoria_id}'   — envelope estourou 2ª vez
--     'conta_sem_cobertura_{lancamento_id}'    — conta a vencer sem saldo
--     'meta_reserva_atingida_{caixinha_id}'    — meta de caixinha atingida
--
-- Checks de cooldown:
--   7 dias por gatilho:
--     SELECT 1 FROM ai_proactive_trigger_log
--     WHERE user_id=$1 AND trigger_key=$2
--       AND triggered_at > NOW() - INTERVAL '7 days'
--     LIMIT 1
--
--   "2ª vez no mês" (envelope_estourado_2x):
--     — Gatilho só dispara se JÁ existe log deste trigger_key neste mês
--       E o cooldown de 7 dias passou (ou seja, é genuinamente a 2ª ocorrência)
--
-- metadata JSONB: dados de contexto para debugging, não usados no frontend.
--   Exemplos:
--     {"nome": "Alimentação", "valor_orcado": 800, "valor_gasto": 967}
--     {"descricao": "Aluguel", "valor": 1800, "vence_em": "2026-03-15"}
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_proactive_trigger_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id    UUID NOT NULL,
  trigger_key  TEXT NOT NULL,
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- FK para a mensagem gerada — útil para rastreabilidade e debugging
  message_id   UUID REFERENCES assistente_mensagens(id) ON DELETE SET NULL,
  -- Dados de contexto do disparo (ex: nome do envelope, valor do déficit)
  metadata     JSONB DEFAULT '{}'
);

-- Cooldown lookup: busca por user + trigger nos últimos N dias
CREATE INDEX IF NOT EXISTS idx_proactive_trigger_cooldown
  ON ai_proactive_trigger_log(user_id, trigger_key, triggered_at DESC);

-- Lookup por família (gatilhos de casal são avaliados por family_id)
CREATE INDEX IF NOT EXISTS idx_proactive_trigger_family
  ON ai_proactive_trigger_log(family_id, trigger_key, triggered_at DESC);

-- RLS
ALTER TABLE ai_proactive_trigger_log ENABLE ROW LEVEL SECURITY;

-- Service role: escrita e leitura total (Edge Functions)
CREATE POLICY "ai_proactive_trigger_log: service role acesso total"
  ON ai_proactive_trigger_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Usuários: leitura do próprio histórico (transparência; não expõe outros)
CREATE POLICY "ai_proactive_trigger_log: usuário lê o próprio"
  ON ai_proactive_trigger_log FOR SELECT
  USING (auth.uid() = user_id);
