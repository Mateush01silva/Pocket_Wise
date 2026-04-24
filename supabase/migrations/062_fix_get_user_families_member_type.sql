-- ============================================================================
-- MIGRATION 062: Atualizar get_user_families com member_type
-- ============================================================================
-- A migration 060 falhou com rollback completo (por causa do erro no
-- get_family_members_with_user), então get_user_families nunca foi atualizada.
-- A migration 061 só corrigiu get_family_members_with_user.
-- Esta migration garante que get_user_families inclua member_type por família.
-- ============================================================================

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

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIM DA MIGRATION 062
-- ============================================================================
