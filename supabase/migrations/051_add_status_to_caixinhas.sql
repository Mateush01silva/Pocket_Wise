-- Migration: Adicionar status, meses_pausados e ordem_exibicao à tabela caixinhas
-- Escopo: Apenas caixinhas de Objetivos & Reservas (tipo objetivo/emergencia)
-- Data: 2026-04-13

-- =====================================================
-- 1. NOVOS CAMPOS NA TABELA CAIXINHAS
-- =====================================================

-- status: substitui a semântica binária de `ativa` com três estados explícitos.
-- `ativa` (BOOL) é mantido intocado para não quebrar queries existentes.
ALTER TABLE caixinhas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa', 'pausada', 'concluida')),
  ADD COLUMN IF NOT EXISTS meses_pausados INTEGER NOT NULL DEFAULT 0
    CHECK (meses_pausados >= 0),
  ADD COLUMN IF NOT EXISTS ordem_exibicao INTEGER DEFAULT NULL;

-- Índice para filtrar por status com performance
CREATE INDEX IF NOT EXISTS idx_caixinhas_status ON caixinhas(status);

-- =====================================================
-- 2. COMENTÁRIOS
-- =====================================================

COMMENT ON COLUMN caixinhas.status IS
  'Estado da caixinha: ativa (funcionamento normal), pausada (sem aportes temporariamente), concluida (meta atingida ou encerrada — arquivada, não deletada)';

COMMENT ON COLUMN caixinhas.meses_pausados IS
  'Quantidade de meses em que a caixinha esteve pausada. Usado para estender target_date automaticamente.';

COMMENT ON COLUMN caixinhas.ordem_exibicao IS
  'Posição de exibição dentro do grupo de horizonte (curto/médio/longo/sem prazo). Nulo = sem ordem definida.';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
