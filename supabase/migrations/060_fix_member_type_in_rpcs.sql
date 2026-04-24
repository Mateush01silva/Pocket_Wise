-- ============================================================================
-- MIGRATION 060: Adicionar member_type nas RPCs get_family_members_with_user
--                e get_user_families
-- ============================================================================
-- PROBLEMA:
--   A migration 057 adicionou a coluna member_type em family_members, mas:
--   1. get_family_members_with_user (029) não inclui member_type no RETURNS TABLE
--      nem no SELECT — logo useConsultorPermissions sempre recebe undefined e
--      nunca detecta isConsultor = true.
--   2. get_user_families (016) não inclui member_type no JSON de cada família —
--      logo não conseguimos saber se o usuário é consultor em uma família.
--
-- SOLUÇÃO:
--   Recriar ambas as funções adicionando member_type nos lugares corretos.
--   Nenhuma outra lógica é alterada.
-- ============================================================================

-- ─── 1. get_family_members_with_user ─────────────────────────────────────────
-- Adiciona member_type ao RETURNS TABLE e ao RETURN QUERY SELECT.

CREATE OR REPLACE FUNCTION get_family_members_with_user(p_family_id UUID)
RETURNS TABLE (
  id              UUID,
  family_id       UUID,
  user_id         UUID,
  role            family_role,
  joined_at       TIMESTAMPTZ,
  user_name       TEXT,
  patrimonio_base DECIMAL(15, 2),
  user_created_at TIMESTAMPTZ,
  member_type     TEXT
)
AS $$
DECLARE
  user_uuid UUID;
BEGIN
  user_uuid := auth.uid();

  IF user_uuid IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_members.family_id = p_family_id
      AND family_members.user_id   = user_uuid
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    fm.id,
    fm.family_id,
    fm.user_id,
    fm.role,
    fm.joined_at,
    u.nome                              AS user_name,
    u.patrimonio_base,
    u.created_at                        AS user_created_at,
    COALESCE(fm.member_type, 'familiar') AS member_type
  FROM family_members fm
  LEFT JOIN users u ON fm.user_id = u.id
  WHERE fm.family_id = p_family_id
  ORDER BY fm.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_family_members_with_user(UUID) TO authenticated;

-- ─── 2. get_user_families ────────────────────────────────────────────────────
-- Adiciona member_type ao json_build_object de cada família.

CREATE OR REPLACE FUNCTION get_user_families()
RETURNS JSON AS $$
DECLARE
  user_uuid UUID;
  result JSON;
BEGIN
  user_uuid := auth.uid();
  IF user_uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT json_build_object(
    'success', true,
    'families', COALESCE(json_agg(
      json_build_object(
        'family_id',   f.id,
        'nome',        f.nome,
        'role',        fm.role,
        'is_personal', (u.personal_family_id = f.id),
        'member_type', COALESCE(fm.member_type, 'familiar')
      )
      ORDER BY (u.personal_family_id = f.id) DESC, f.nome
    ), '[]'::json),
    'active_family_id',   u.family_id,
    'personal_family_id', u.personal_family_id
  )
  INTO result
  FROM family_members fm
  JOIN families f ON f.id = fm.family_id
  JOIN users    u ON u.id = user_uuid
  WHERE fm.user_id = user_uuid;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_families() TO authenticated;

-- Forçar reload do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIM DA MIGRATION 060
-- ============================================================================
