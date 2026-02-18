-- Migration: Fix Security Issues on Views
-- Descrição: Corrige problemas de segurança reportados pelo Supabase:
--   1. auth_users_exposed: Views que expõem auth.users para roles anon/authenticated
--   2. security_definer_view: Views criadas com SECURITY DEFINER (padrão do postgres superuser)
--      que bypassam RLS das tabelas subjacentes
-- Data: 2026-02-18
-- Ref: https://supabase.com/docs/guides/database/database-linter?lint=0002_auth_users_exposed
--      https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
--
-- Nota: Todas as views usam DROP + CREATE para evitar o erro 42P16
-- (CREATE OR REPLACE VIEW não permite alterar colunas nem opções como security_invoker
--  em algumas versões do PostgreSQL/Supabase)

-- =====================================================
-- FIX 1: family_members_with_user
-- Problemas: auth_users_exposed + security_definer_view
-- Solução: Recriar sem JOIN auth.users + security_invoker = true
-- =====================================================

DROP VIEW IF EXISTS family_members_with_user CASCADE;

CREATE VIEW family_members_with_user
WITH (security_invoker = true)
AS
SELECT
  fm.id,
  fm.family_id,
  fm.user_id,
  fm.role,
  fm.joined_at,
  u.nome as user_name,
  u.patrimonio_base,
  u.created_at as user_created_at
FROM family_members fm
JOIN users u ON fm.user_id = u.id;

-- =====================================================
-- FIX 2: family_invites_with_details
-- Problemas: auth_users_exposed + security_definer_view
-- Solução: Recriar sem JOIN auth.users + security_invoker = true
-- =====================================================

DROP VIEW IF EXISTS family_invites_with_details CASCADE;

CREATE VIEW family_invites_with_details
WITH (security_invoker = true)
AS
SELECT
  fi.id,
  fi.family_id,
  fi.invited_by,
  fi.invited_email,
  fi.token,
  fi.role,
  fi.status,
  fi.message,
  fi.expires_at,
  fi.accepted_at,
  fi.accepted_by,
  fi.created_at,
  f.nome as family_name,
  u.nome as invited_by_name
FROM family_invites fi
LEFT JOIN families f ON fi.family_id = f.id
LEFT JOIN users u ON fi.invited_by = u.id;

-- =====================================================
-- FIX 3: v_orcamentos_resumo
-- Problema: security_definer_view
-- Solução: Recriar com security_invoker = true
-- =====================================================

DROP VIEW IF EXISTS v_orcamentos_resumo CASCADE;

CREATE VIEW v_orcamentos_resumo
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.family_id,
  o.mes_referencia,
  o.meta_poupanca,
  o.meta_poupanca_percentual,
  o.status,
  COALESCE(SUM(cb.valor_orcado), 0) AS total_orcado,
  COUNT(cb.id) AS total_categorias,
  o.created_at,
  o.updated_at
FROM orcamentos_mensais o
LEFT JOIN categorias_budget cb ON cb.orcamento_id = o.id
GROUP BY o.id;

-- =====================================================
-- FIX 4: rebalanceamentos_com_detalhes
-- Problema: security_definer_view
-- Solução: Recriar com security_invoker = true
-- =====================================================

DROP VIEW IF EXISTS rebalanceamentos_com_detalhes CASCADE;

CREATE VIEW rebalanceamentos_com_detalhes
WITH (security_invoker = true)
AS
SELECT
  hr.id,
  hr.family_id,
  hr.realizado_por,
  hr.orcamento_id,
  hr.valor_transferido,
  hr.motivo,
  hr.foi_sugestao_automatica,
  hr.created_at,
  -- Categoria origem
  co.nome as categoria_origem_nome,
  co.icone as categoria_origem_icone,
  co.cor as categoria_origem_cor,
  co.prioridade as categoria_origem_prioridade,
  -- Categoria destino
  cd.nome as categoria_destino_nome,
  cd.icone as categoria_destino_icone,
  cd.cor as categoria_destino_cor,
  cd.prioridade as categoria_destino_prioridade,
  -- Usuário
  u.nome as realizado_por_nome
FROM historico_rebalanceamentos hr
LEFT JOIN categorias co ON hr.categoria_origem_id = co.id
LEFT JOIN categorias cd ON hr.categoria_destino_id = cd.id
LEFT JOIN users u ON hr.realizado_por = u.id;

-- =====================================================
-- FIX 5: caixinhas_with_creator
-- Problema: security_definer_view
-- Solução: Recriar com security_invoker = true
-- =====================================================

DROP VIEW IF EXISTS caixinhas_with_creator CASCADE;

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
-- REGRANT: Restaurar permissões após recriar views
-- =====================================================

GRANT SELECT ON family_members_with_user TO authenticated;
GRANT SELECT ON family_invites_with_details TO authenticated;
GRANT SELECT ON v_orcamentos_resumo TO authenticated;
GRANT SELECT ON rebalanceamentos_com_detalhes TO authenticated;
GRANT SELECT ON caixinhas_with_creator TO authenticated;

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
