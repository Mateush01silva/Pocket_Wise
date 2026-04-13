-- Migration: Tabela caixinha_historico_mensal
-- Descrição: Registra o histórico de contribuições mensais por caixinha (streak, mini-timeline)
-- Escopo: Apenas caixinhas de Objetivos & Reservas (tipo objetivo/emergencia)
-- Data: 2026-04-13

-- =====================================================
-- 1. TABELA caixinha_historico_mensal
-- =====================================================

-- Registra, por mês, se houve depósito em cada caixinha.
-- Usado para: mini-timeline de 6 meses, cálculo de streak, badge de status.
-- Populado retroativamente a partir de transacoes_caixinhas + caixinha_intencoes_mensais.

CREATE TABLE IF NOT EXISTS caixinha_historico_mensal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixinha_id UUID NOT NULL REFERENCES caixinhas(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,           -- Sempre primeiro dia do mês: YYYY-MM-01
  houve_deposito BOOLEAN NOT NULL DEFAULT false,
  valor_depositado DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (valor_depositado >= 0),
  valor_planejado DECIMAL(15,2) DEFAULT NULL,  -- Da intenção do mês, se existia
  mes_pausado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Apenas um registro por caixinha por mês
  UNIQUE(caixinha_id, mes_referencia)
);

-- =====================================================
-- 2. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_historico_caixinha_id
  ON caixinha_historico_mensal(caixinha_id);

CREATE INDEX IF NOT EXISTS idx_historico_mes_referencia
  ON caixinha_historico_mensal(mes_referencia);

-- Índice composto para queries de timeline (última N meses de uma caixinha)
CREATE INDEX IF NOT EXISTS idx_historico_caixinha_mes
  ON caixinha_historico_mensal(caixinha_id, mes_referencia DESC);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE caixinha_historico_mensal ENABLE ROW LEVEL SECURITY;

-- Membros da família podem ver histórico das suas caixinhas
CREATE POLICY "Family members can view caixinha monthly history"
  ON caixinha_historico_mensal FOR SELECT
  USING (
    caixinha_id IN (
      SELECT id FROM caixinhas
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Membros da família podem criar histórico nas suas caixinhas
CREATE POLICY "Family members can create caixinha monthly history"
  ON caixinha_historico_mensal FOR INSERT
  WITH CHECK (
    caixinha_id IN (
      SELECT id FROM caixinhas
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Membros da família podem atualizar histórico das suas caixinhas
CREATE POLICY "Family members can update caixinha monthly history"
  ON caixinha_historico_mensal FOR UPDATE
  USING (
    caixinha_id IN (
      SELECT id FROM caixinhas
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- =====================================================
-- 4. COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE caixinha_historico_mensal IS
  'Histórico consolidado de contribuições mensais por caixinha. Populado retroativamente e atualizado após cada depósito. Base para mini-timeline e streak.';

COMMENT ON COLUMN caixinha_historico_mensal.houve_deposito IS
  'True se houve pelo menos um depósito nesta caixinha neste mês.';

COMMENT ON COLUMN caixinha_historico_mensal.valor_depositado IS
  'Soma de todos os depósitos nesta caixinha neste mês.';

COMMENT ON COLUMN caixinha_historico_mensal.valor_planejado IS
  'Valor que havia sido planejado em caixinha_intencoes_mensais para este mês, se existia.';

COMMENT ON COLUMN caixinha_historico_mensal.mes_pausado IS
  'True se a caixinha estava pausada neste mês. Meses pausados não contam como falta no streak.';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
