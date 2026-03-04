-- =====================================================
-- Migration 031: Fix SECURITY DEFINER on caixinhas_with_creator view
-- =====================================================
-- A migration 030 recriou a view sem WITH (security_invoker = true),
-- o que faz a view usar as permissões do criador (SECURITY DEFINER)
-- em vez do usuário que está fazendo a query.
-- Esta migration recria a view com security_invoker = true,
-- garantindo que RLS e permissões do usuário autenticado sejam respeitados.
-- =====================================================

DROP VIEW IF EXISTS caixinhas_with_creator;

CREATE VIEW caixinhas_with_creator
WITH (security_invoker = true)
AS
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

-- Re-aplicar permissões após DROP + CREATE
GRANT SELECT ON caixinhas_with_creator TO authenticated;
GRANT SELECT ON caixinhas_with_creator TO anon;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
