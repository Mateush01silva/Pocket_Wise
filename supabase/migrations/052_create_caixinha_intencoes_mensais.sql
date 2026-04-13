-- Migration: Tabela caixinha_intencoes_mensais
-- Descrição: Armazena a intenção de aporte mensal por caixinha (planejamento no orçamento)
-- Escopo: Apenas caixinhas de Objetivos & Reservas (tipo objetivo/emergencia)
-- Data: 2026-04-13

-- =====================================================
-- 1. TABELA caixinha_intencoes_mensais
-- =====================================================

-- Registra quanto o usuário PLANEJA aportar em cada caixinha num dado mês.
-- Não altera saldos nem cria envelopes — é puramente uma intenção declarada.

CREATE TABLE IF NOT EXISTS caixinha_intencoes_mensais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixinha_id UUID NOT NULL REFERENCES caixinhas(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,         -- Sempre primeiro dia do mês: YYYY-MM-01
  valor_planejado DECIMAL(15,2) NOT NULL CHECK (valor_planejado >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Apenas uma intenção por caixinha por mês
  UNIQUE(caixinha_id, mes_referencia)
);

-- =====================================================
-- 2. ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_intencoes_caixinha_id
  ON caixinha_intencoes_mensais(caixinha_id);

CREATE INDEX IF NOT EXISTS idx_intencoes_mes_referencia
  ON caixinha_intencoes_mensais(mes_referencia);

-- =====================================================
-- 3. TRIGGER updated_at
-- =====================================================

CREATE TRIGGER trigger_update_intencoes_updated_at
  BEFORE UPDATE ON caixinha_intencoes_mensais
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE caixinha_intencoes_mensais ENABLE ROW LEVEL SECURITY;

-- Membros da família podem ver intenções das suas caixinhas
CREATE POLICY "Family members can view caixinha intentions"
  ON caixinha_intencoes_mensais FOR SELECT
  USING (
    caixinha_id IN (
      SELECT id FROM caixinhas
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Membros da família podem criar intenções nas suas caixinhas
CREATE POLICY "Family members can create caixinha intentions"
  ON caixinha_intencoes_mensais FOR INSERT
  WITH CHECK (
    caixinha_id IN (
      SELECT id FROM caixinhas
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Membros da família podem atualizar intenções das suas caixinhas
CREATE POLICY "Family members can update caixinha intentions"
  ON caixinha_intencoes_mensais FOR UPDATE
  USING (
    caixinha_id IN (
      SELECT id FROM caixinhas
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Membros da família podem deletar intenções das suas caixinhas
CREATE POLICY "Family members can delete caixinha intentions"
  ON caixinha_intencoes_mensais FOR DELETE
  USING (
    caixinha_id IN (
      SELECT id FROM caixinhas
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- =====================================================
-- 5. COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE caixinha_intencoes_mensais IS
  'Intenções de aporte mensal por caixinha, declaradas na seção "Metas e Sonhos" do planejamento do orçamento. Não altera saldos — é apenas planejamento.';

COMMENT ON COLUMN caixinha_intencoes_mensais.mes_referencia IS
  'Mês de referência no formato YYYY-MM-01 (sempre primeiro dia do mês).';

COMMENT ON COLUMN caixinha_intencoes_mensais.valor_planejado IS
  'Quanto o usuário planeja aportar nesta caixinha neste mês. Zero é válido (usuario declarou que não vai aportar).';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
