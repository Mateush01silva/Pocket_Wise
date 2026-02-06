-- Migration: Adicionar destino_mes_referencia na tabela transacoes_caixinhas
-- Descrição: Este campo permite rastrear para qual mês do orçamento uma retirada de caixinha será utilizada
-- Data: 2025-02-06

-- Adicionar coluna destino_mes_referencia
ALTER TABLE transacoes_caixinhas
ADD COLUMN IF NOT EXISTS destino_mes_referencia DATE;

-- Comentário explicativo
COMMENT ON COLUMN transacoes_caixinhas.destino_mes_referencia IS 'Para retiradas: indica para qual mês o valor será utilizado no orçamento (YYYY-MM-DD)';
