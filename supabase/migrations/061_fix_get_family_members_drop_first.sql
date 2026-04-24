-- ============================================================================
-- MIGRATION 061: Recriar get_family_members_with_user com member_type
-- ============================================================================
-- A migration 060 falhou porque CREATE OR REPLACE não pode alterar o tipo
-- de retorno de uma função já existente. Como o Supabase registrou a 060
-- como aplicada antes da falha, esta nova migration garante o DROP + CREATE.
-- ============================================================================

-- DROP obrigatório antes de mudar o RETURNS TABLE
DROP FUNCTION IF EXISTS get_family_members_with_user(UUID);

CREATE FUNCTION get_family_members_with_user(p_family_id UUID)
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
    u.nome                               AS user_name,
    u.patrimonio_base,
    u.created_at                         AS user_created_at,
    COALESCE(fm.member_type, 'familiar') AS member_type
  FROM family_members fm
  LEFT JOIN users u ON fm.user_id = u.id
  WHERE fm.family_id = p_family_id
  ORDER BY fm.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_family_members_with_user(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- FIM DA MIGRATION 061
-- ============================================================================
