-- ============================================================================
-- MIGRATION 066: Corrigir GROUP BY no get_user_families
-- ============================================================================
-- A migration 062 referenciava u.family_id e u.personal_family_id fora da
-- cláusula de agregação (json_agg), causando erro PostgreSQL 42803 para
-- usuários com múltiplas famílias.
-- Fix: buscar family_id e personal_family_id em variáveis locais antes
-- da query agregada, eliminando a necessidade de GROUP BY.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_families()
RETURNS JSON AS $$
DECLARE
  user_uuid            UUID;
  v_active_family_id   UUID;
  v_personal_family_id UUID;
  result               JSON;
BEGIN
  user_uuid := auth.uid();
  IF user_uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Buscar dados do usuário em variáveis locais (evita GROUP BY no aggregate)
  SELECT family_id, personal_family_id
    INTO v_active_family_id, v_personal_family_id
    FROM users
   WHERE id = user_uuid;

  -- Agregar todas as famílias do usuário
  SELECT json_build_object(
    'success', true,
    'families', COALESCE(json_agg(
      json_build_object(
        'family_id',   f.id,
        'nome',        f.nome,
        'role',        fm.role,
        'is_personal', (v_personal_family_id = f.id),
        'member_type', COALESCE(fm.member_type, 'familiar')
      )
      ORDER BY (v_personal_family_id = f.id) DESC, f.nome
    ), '[]'::json),
    'active_family_id',   v_active_family_id,
    'personal_family_id', v_personal_family_id
  )
  INTO result
  FROM family_members fm
  JOIN families f ON f.id = fm.family_id
  WHERE fm.user_id = user_uuid;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_families() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIM DA MIGRATION 066
-- ============================================================================
