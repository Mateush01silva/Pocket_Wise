-- Migration: Atualizar view caixinhas_with_creator com saldo_conquistado
-- Descrição: Adiciona saldo_conquistado (soma bruta de depósitos) e ajusta
--            progresso_percentual e valor_faltante para usar esse campo.
--            Para caixinhas sem retiradas, o valor é idêntico ao saldo_atual.
-- Data: 2026-04-13
--
-- NOTA: DROP + CREATE é o padrão estabelecido na migration 030 porque
--       CREATE OR REPLACE VIEW não permite alterar posição de colunas existentes.
--       GRANTs são reaplicados ao final.

-- =====================================================
-- 1. RECRIAR VIEW COM saldo_conquistado e novos campos de status
-- =====================================================

DROP VIEW IF EXISTS caixinhas_with_creator;

CREATE VIEW caixinhas_with_creator AS
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
  c.status,
  c.meses_pausados,
  c.ordem_exibicao,
  c.cor,
  c.descricao,
  c.valor_mercado,
  c.data_valor_mercado,
  c.subtipo_investimento,
  c.conta_investimento_id,
  c.created_at,
  c.updated_at,
  u.nome AS criador_nome,

  -- saldo_conquistado: soma histórica de TODOS os depósitos (nunca diminui)
  -- Calculado retroativamente a partir de transacoes_caixinhas
  (
    SELECT COALESCE(SUM(valor), 0)
    FROM transacoes_caixinhas
    WHERE caixinha_id = c.id AND tipo = 'deposito'
  ) AS saldo_conquistado,

  -- progresso_percentual: agora baseado no saldo_conquistado
  -- Para caixinhas sem retiradas: igual ao comportamento anterior
  CASE
    WHEN c.meta_valor IS NOT NULL AND c.meta_valor > 0 THEN
      ROUND(
        (
          (SELECT COALESCE(SUM(valor), 0)
           FROM transacoes_caixinhas
           WHERE caixinha_id = c.id AND tipo = 'deposito')
          / c.meta_valor * 100
        )::numeric,
        2
      )
    ELSE
      NULL
  END AS progresso_percentual,

  -- valor_faltante: baseado no saldo_conquistado
  CASE
    WHEN c.meta_valor IS NOT NULL THEN
      GREATEST(
        0,
        c.meta_valor - (
          SELECT COALESCE(SUM(valor), 0)
          FROM transacoes_caixinhas
          WHERE caixinha_id = c.id AND tipo = 'deposito'
        )
      )
    ELSE
      NULL
  END AS valor_faltante,

  -- Total de transações (mantido como estava)
  (SELECT COUNT(*) FROM transacoes_caixinhas WHERE caixinha_id = c.id) AS total_transacoes

FROM caixinhas c
LEFT JOIN users u ON c.criado_por = u.id;

-- =====================================================
-- 2. REAPLICAR PERMISSÕES (perdidas no DROP)
-- =====================================================

GRANT SELECT ON caixinhas_with_creator TO authenticated;
GRANT SELECT ON caixinhas_with_creator TO anon;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
