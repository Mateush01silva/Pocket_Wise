-- Migration: Caixinhas (Potes de Objetivos)
-- Descrição: Criação das tabelas para sistema de caixinhas/potes de objetivos
-- Data: 2026-01-17

-- =====================================================
-- 1. ENUM TYPES
-- =====================================================

-- Tipo de caixinha
CREATE TYPE caixinha_tipo AS ENUM ('objetivo', 'emergencia', 'investimento');

-- Tipo de transação da caixinha
CREATE TYPE transacao_caixinha_tipo AS ENUM ('deposito', 'retirada');

-- =====================================================
-- 2. CAIXINHAS TABLE
-- =====================================================

-- Tabela de caixinhas/potes de objetivos
CREATE TABLE IF NOT EXISTS caixinhas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  criado_por UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  nome VARCHAR(100) NOT NULL,
  tipo caixinha_tipo NOT NULL,
  meta_valor DECIMAL(15, 2), -- Valor da meta (opcional para investimentos)
  prazo_data DATE, -- Data limite para atingir a meta (opcional)
  icone TEXT, -- Emoji ou ícone
  saldo_atual DECIMAL(15, 2) DEFAULT 0 NOT NULL,
  ativa BOOLEAN DEFAULT TRUE NOT NULL,
  cor TEXT DEFAULT '#6366f1', -- Cor para visualização
  descricao TEXT, -- Descrição opcional do objetivo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Validações
  CHECK (saldo_atual >= 0),
  CHECK (meta_valor IS NULL OR meta_valor > 0)
);

-- Índices para performance
CREATE INDEX idx_caixinhas_family_id ON caixinhas(family_id);
CREATE INDEX idx_caixinhas_criado_por ON caixinhas(criado_por);
CREATE INDEX idx_caixinhas_tipo ON caixinhas(tipo);
CREATE INDEX idx_caixinhas_ativa ON caixinhas(ativa);

-- =====================================================
-- 3. TRANSACOES_CAIXINHAS TABLE
-- =====================================================

-- Tabela de transações das caixinhas (depósitos e retiradas)
CREATE TABLE IF NOT EXISTS transacoes_caixinhas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caixinha_id UUID NOT NULL REFERENCES caixinhas(id) ON DELETE CASCADE,
  realizado_por UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  valor DECIMAL(15, 2) NOT NULL CHECK (valor > 0),
  tipo transacao_caixinha_tipo NOT NULL,
  descricao TEXT,
  origem_mes_referencia DATE, -- Se veio de saldo mensal, qual mês
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CHECK (valor > 0)
);

-- Índices para performance
CREATE INDEX idx_transacoes_caixinhas_caixinha_id ON transacoes_caixinhas(caixinha_id);
CREATE INDEX idx_transacoes_caixinhas_realizado_por ON transacoes_caixinhas(realizado_por);
CREATE INDEX idx_transacoes_caixinhas_tipo ON transacoes_caixinhas(tipo);
CREATE INDEX idx_transacoes_caixinhas_created_at ON transacoes_caixinhas(created_at);

-- =====================================================
-- 4. FUNCTIONS
-- =====================================================

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER trigger_update_caixinhas_updated_at
  BEFORE UPDATE ON caixinhas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para atualizar saldo da caixinha após transação
CREATE OR REPLACE FUNCTION atualizar_saldo_caixinha()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Atualizar saldo baseado no tipo de transação
    IF NEW.tipo = 'deposito' THEN
      UPDATE caixinhas
      SET saldo_atual = saldo_atual + NEW.valor
      WHERE id = NEW.caixinha_id;
    ELSIF NEW.tipo = 'retirada' THEN
      UPDATE caixinhas
      SET saldo_atual = saldo_atual - NEW.valor
      WHERE id = NEW.caixinha_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Reverter a transação ao deletar
    IF OLD.tipo = 'deposito' THEN
      UPDATE caixinhas
      SET saldo_atual = saldo_atual - OLD.valor
      WHERE id = OLD.caixinha_id;
    ELSIF OLD.tipo = 'retirada' THEN
      UPDATE caixinhas
      SET saldo_atual = saldo_atual + OLD.valor
      WHERE id = OLD.caixinha_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar saldo automaticamente
CREATE TRIGGER trigger_atualizar_saldo_caixinha
  AFTER INSERT OR DELETE ON transacoes_caixinhas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_saldo_caixinha();

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Habilitar RLS nas tabelas
ALTER TABLE caixinhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes_caixinhas ENABLE ROW LEVEL SECURITY;

-- ========== CAIXINHAS POLICIES ==========

-- Membros da família podem ver caixinhas da família
CREATE POLICY "Family members can view family caixinhas"
  ON caixinhas FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Membros da família podem criar caixinhas
CREATE POLICY "Family members can create caixinhas"
  ON caixinhas FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
    AND criado_por = auth.uid()
  );

-- Membros da família podem atualizar caixinhas
CREATE POLICY "Family members can update caixinhas"
  ON caixinhas FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- Membros da família podem deletar caixinhas
CREATE POLICY "Family members can delete caixinhas"
  ON caixinhas FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- ========== TRANSACOES_CAIXINHAS POLICIES ==========

-- Membros podem ver transações de caixinhas da família
CREATE POLICY "Family members can view caixinha transactions"
  ON transacoes_caixinhas FOR SELECT
  USING (
    caixinha_id IN (
      SELECT id FROM caixinhas
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Membros podem criar transações em caixinhas da família
CREATE POLICY "Family members can create caixinha transactions"
  ON transacoes_caixinhas FOR INSERT
  WITH CHECK (
    caixinha_id IN (
      SELECT id FROM caixinhas
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
    AND realizado_por = auth.uid()
  );

-- Membros podem deletar transações de caixinhas da família
CREATE POLICY "Family members can delete caixinha transactions"
  ON transacoes_caixinhas FOR DELETE
  USING (
    caixinha_id IN (
      SELECT id FROM caixinhas
      WHERE family_id IN (
        SELECT family_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- =====================================================
-- 6. VIEWS ÚTEIS
-- =====================================================

-- View para ver caixinhas com informações do criador
CREATE OR REPLACE VIEW caixinhas_with_creator AS
SELECT
  c.id,
  c.family_id,
  c.criado_por,
  c.nome,
  c.tipo,
  c.meta_valor,
  c.prazo_data,
  c.icone,
  c.saldo_atual,
  c.ativa,
  c.cor,
  c.descricao,
  c.created_at,
  c.updated_at,
  u.nome as criador_nome,
  -- Calcular progresso (se tiver meta)
  CASE
    WHEN c.meta_valor IS NOT NULL AND c.meta_valor > 0 THEN
      ROUND((c.saldo_atual / c.meta_valor * 100)::numeric, 2)
    ELSE
      NULL
  END as progresso_percentual,
  -- Calcular quanto falta (se tiver meta)
  CASE
    WHEN c.meta_valor IS NOT NULL THEN
      GREATEST(0, c.meta_valor - c.saldo_atual)
    ELSE
      NULL
  END as valor_faltante,
  -- Total de transações
  (SELECT COUNT(*) FROM transacoes_caixinhas WHERE caixinha_id = c.id) as total_transacoes
FROM caixinhas c
LEFT JOIN users u ON c.criado_por = u.id;

-- =====================================================
-- 7. COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE caixinhas IS 'Caixinhas/Potes para guardar dinheiro com objetivos específicos';
COMMENT ON TABLE transacoes_caixinhas IS 'Histórico de depósitos e retiradas das caixinhas';
COMMENT ON COLUMN caixinhas.tipo IS 'Tipo da caixinha: objetivo (viagem, carro), emergencia (reserva), investimento';
COMMENT ON COLUMN caixinhas.meta_valor IS 'Valor da meta financeira (opcional para tipo investimento)';
COMMENT ON COLUMN caixinhas.prazo_data IS 'Data limite para atingir a meta (opcional)';
COMMENT ON COLUMN caixinhas.saldo_atual IS 'Saldo atual da caixinha (atualizado automaticamente por trigger)';
COMMENT ON COLUMN transacoes_caixinhas.origem_mes_referencia IS 'Se veio de sobra de orçamento mensal, qual mês de referência';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
