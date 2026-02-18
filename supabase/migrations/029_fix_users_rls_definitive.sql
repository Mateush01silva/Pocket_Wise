-- Migration 029: Fix definitivo — policy users não-recursiva
-- ============================================================================
--
-- POR QUE ISSO É NECESSÁRIO:
--
--   A migration 027 criou dependência circular (users ↔ family_members).
--   A migration 028 tentou reverter, mas pode não ter sido aplicada caso o
--   Supabase CLI tenha marcado a migration como "aplicada" na primeira
--   tentativa com erro de sintaxe.
--
--   Além disso, a policy original usa auto-referência:
--     family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
--   Isso força PostgreSQL a aplicar a RLS de users recursivamente, o que
--   pode causar erros ou resultados inesperados em algumas versões.
--
-- SOLUÇÃO:
--
--   1. Criar função SECURITY DEFINER get_current_user_family_id() que retorna
--      o family_id do usuário atual SEM aplicar RLS (sem recursão).
--
--   2. Recriar a policy de users usando esta função — sem auto-referência,
--      sem dependência de family_members.
--
-- ============================================================================

-- =====================================================
-- PARTE 1: Função helper SECURITY DEFINER
-- Retorna family_id do usuário atual sem RLS (quebra recursão)
-- =====================================================

CREATE OR REPLACE FUNCTION get_current_user_family_id()
RETURNS UUID AS $$
  SELECT family_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_current_user_family_id() TO authenticated;

-- =====================================================
-- PARTE 2: Recriar policy de users SEM auto-referência e
--          SEM dependência de family_members
-- =====================================================

DROP POLICY IF EXISTS "Users can view family members" ON users;

CREATE POLICY "Users can view family members"
  ON users FOR SELECT
  USING (
    -- Sempre pode ver a si mesmo
    id = auth.uid()
    OR
    -- Pode ver usuários da mesma família ativa
    -- Usa função SECURITY DEFINER: sem recursão, sem circular
    family_id = get_current_user_family_id()
  );

-- =====================================================
-- PARTE 3: Garantir que a função da migration 028 existe
--          (pode não ter sido criada se 028 falhou)
-- =====================================================

CREATE OR REPLACE FUNCTION get_family_members_with_user(p_family_id UUID)
RETURNS TABLE (
  id              UUID,
  family_id       UUID,
  user_id         UUID,
  role            family_role,
  joined_at       TIMESTAMPTZ,
  user_name       TEXT,
  patrimonio_base DECIMAL(15, 2),
  user_created_at TIMESTAMPTZ
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
    u.nome              AS user_name,
    u.patrimonio_base,
    u.created_at        AS user_created_at
  FROM family_members fm
  LEFT JOIN users u ON fm.user_id = u.id
  WHERE fm.family_id = p_family_id
  ORDER BY fm.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_family_members_with_user(UUID) TO authenticated;

-- Forçar reload do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
