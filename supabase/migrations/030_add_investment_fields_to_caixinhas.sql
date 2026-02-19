-- Migration: Campos de Investimento nas Caixinhas
-- Descrição: Adiciona valor_mercado, subtipo e vinculação com conta bancária
--            para caixinhas do tipo investimento.
-- Data: 2026-02-19

-- =====================================================
-- 1. NOVOS CAMPOS NA TABELA CAIXINHAS
-- =====================================================

-- Valor atual de mercado (atualizado manualmente pelo usuário)
-- Diferente de saldo_atual (total aportado, calculado pelo trigger)
ALTER TABLE caixinhas
  ADD COLUMN IF NOT EXISTS valor_mercado DECIMAL(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_valor_mercado TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS subtipo_investimento TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS conta_investimento_id UUID REFERENCES contas_bancarias(id) ON DELETE SET NULL;

-- Constraint: subtipo só é relevante para tipo='investimento'
-- Valores válidos: renda_fixa, renda_variavel, fii, cripto, internacional, outro
ALTER TABLE caixinhas
  ADD CONSTRAINT check_subtipo_investimento CHECK (
    tipo != 'investimento' OR subtipo_investimento IN (
      'renda_fixa', 'renda_variavel', 'fii', 'cripto', 'internacional', 'outro'
    ) OR subtipo_investimento IS NULL
  );

-- Constraint: conta_investimento_id só pode ser preenchido para tipo='investimento'
-- (sem constraint formal pois o tipo pode mudar; deixamos a validação no app)

-- Índice para buscar caixinhas vinculadas a uma conta de investimento
CREATE INDEX IF NOT EXISTS idx_caixinhas_conta_investimento
  ON caixinhas(conta_investimento_id)
  WHERE conta_investimento_id IS NOT NULL;

COMMENT ON COLUMN caixinhas.valor_mercado IS 'Valor atual de mercado do investimento (atualizado manualmente). Diferente de saldo_atual que representa o total aportado.';
COMMENT ON COLUMN caixinhas.data_valor_mercado IS 'Quando o valor de mercado foi atualizado pela última vez';
COMMENT ON COLUMN caixinhas.subtipo_investimento IS 'Subtipo do investimento: renda_fixa, renda_variavel, fii, cripto, internacional, outro';
COMMENT ON COLUMN caixinhas.conta_investimento_id IS 'Conta bancária de investimento vinculada. Variações de mercado atualizam automaticamente o saldo desta conta.';

-- =====================================================
-- 2. RECRIAR VIEW COM NOVOS CAMPOS
-- =====================================================

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
  c.valor_mercado,
  c.data_valor_mercado,
  c.subtipo_investimento,
  c.conta_investimento_id,
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
-- FIM DA MIGRATION
-- =====================================================
