-- ============================================================================
-- MIGRATION 068: RPC get_consultant_clients_enriched
-- Retorna dados enriquecidos de todos os clientes de um consultor em uma
-- única chamada, contornando as RLS policies via SECURITY DEFINER.
-- Estritamente aditiva — somente CREATE OR REPLACE FUNCTION.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_consultant_clients_enriched()
RETURNS JSON AS $$
DECLARE
  v_user_id     UUID;
  v_results     JSON;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT json_agg(row_to_json(t)) INTO v_results
  FROM (
    SELECT
      f.id                        AS family_id,
      f.nome                      AS nome,

      -- ── Plano da família (tier do admin) ──────────────────────────────────
      COALESCE(pu.tier, 'explorador') AS plan_tier,

      -- ── Permissão de Pocks ────────────────────────────────────────────────
      COALESCE(cp.can_view_pocks, true) AS can_view_pocks,

      -- ── Score Pocks (mês atual) ───────────────────────────────────────────
      -- Só retorna valor se: can_view_pocks = true E plano do cliente = mestre
      CASE
        WHEN COALESCE(cp.can_view_pocks, true) = false           THEN NULL
        WHEN COALESCE(pu.tier, 'explorador') <> 'mestre'         THEN NULL
        ELSE pms.total_score
      END AS pocks_score,

      -- ── Status do Pocks ────────────────────────────────────────────────────
      -- 'no_access'  → consultor sem permissão ou plano do cliente não é Mestre
      -- 'pending'    → Mestre mas sem score calculado no mês atual
      -- 'calculated' → Mestre com score no mês atual
      CASE
        WHEN COALESCE(cp.can_view_pocks, true) = false   THEN 'no_access'
        WHEN COALESCE(pu.tier, 'explorador') <> 'mestre' THEN 'no_access'
        WHEN pms.total_score IS NULL                     THEN 'pending'
        ELSE 'calculated'
      END AS pocks_status,

      -- ── Última transação ───────────────────────────────────────────────────
      last_tx.last_date AS last_transaction_date,

      -- ── Alerta de inatividade: sem lançamento nos últimos 7 dias ──────────
      CASE
        WHEN last_tx.last_date IS NULL                           THEN true
        WHEN last_tx.last_date < (CURRENT_DATE - INTERVAL '7 days') THEN true
        ELSE false
      END AS has_inactivity_alert,

      -- ── Envelopes estourados (mês atual) ──────────────────────────────────
      COALESCE(neg_env.negative_count, 0) AS negative_envelopes_count

    FROM family_members fm_me
    JOIN families f ON f.id = fm_me.family_id

    -- Admin da família (para buscar o plano)
    LEFT JOIN family_members fm_admin
      ON fm_admin.family_id = f.id
      AND fm_admin.role = 'admin'
      AND fm_admin.member_type = 'familiar'
    LEFT JOIN plano_usuario pu
      ON pu.user_id = fm_admin.user_id

    -- Permissões do consultor nesta família
    LEFT JOIN consultant_permissions cp
      ON cp.family_id = f.id
      AND cp.family_member_id = fm_me.id

    -- Pocks score do mês atual
    LEFT JOIN pocks_monthly_scores pms
      ON pms.family_id = f.id
      AND pms.month = date_trunc('month', CURRENT_DATE)::DATE

    -- Última transação
    LEFT JOIN LATERAL (
      SELECT MAX(l.data) AS last_date
      FROM lancamentos l
      WHERE l.family_id = f.id
    ) last_tx ON true

    -- Contagem de envelopes estourados no orçamento ativo do mês corrente
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS negative_count
      FROM categorias_budget cb
      JOIN orcamentos_mensais om
        ON om.id = cb.orcamento_id
       AND om.family_id = f.id
       AND om.mes_referencia = date_trunc('month', CURRENT_DATE)::DATE
       AND om.status = 'ativo'
      WHERE cb.valor_orcado < (
        SELECT COALESCE(SUM(l.valor), 0)
        FROM lancamentos l
        WHERE l.family_id = f.id
          AND l.categoria_id = cb.categoria_id
          AND l.tipo = 'despesa'
          AND l.status = 'pago'
          AND date_trunc('month', l.data) = om.mes_referencia
      )
    ) neg_env ON true

    WHERE fm_me.user_id = v_user_id
      AND fm_me.member_type = 'consultor'

    ORDER BY f.nome
  ) t;

  RETURN json_build_object(
    'success', true,
    'data', COALESCE(v_results, '[]'::JSON)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_consultant_clients_enriched() TO authenticated;

-- ============================================================================
-- FIM DA MIGRATION 068
-- ============================================================================
