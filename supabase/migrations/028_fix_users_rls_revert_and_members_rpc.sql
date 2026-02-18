-- Migration 028: EMERGÊNCIA — Reverte policy circular + fix permanente de nomes
-- ============================================================================
--
-- PROBLEMA CRÍTICO (migration 027):
--   A policy adicionada em 027 criou dependência circular:
--     users RLS → consulta family_members
--     family_members RLS → consulta users
--   PostgreSQL detecta o loop infinito e bloqueia TODAS as queries em users,
--   quebrando toda a aplicação (transações, perfil, membros, etc.).
--
-- CORREÇÃO IMEDIATA:
--   Reverter a policy de users para a versão original (sem family_members).
--
-- FIX PERMANENTE PARA OS NOMES:
--   Criar função SECURITY DEFINER get_family_members_with_user(UUID).
--   Igual ao padrão já adotado em get_invite_by_token e accept_family_invite.
--   A função bypassa o RLS de users, portanto retorna user_name corretamente
--   para membros cujo users.family_id aponta para outra família (multi-família).
--   Segurança garantida: a função valida que o caller é membro da família
--   solicitada antes de retornar qualquer dado.
-- ============================================================================

-- =====================================================
-- PARTE 1: Reverter policy circular (EMERGÊNCIA)
-- =====================================================

DROP POLICY IF EXISTS "Users can view family members" ON users;

CREATE POLICY "Users can view family members"
  ON users FOR SELECT
  USING (
    id = auth.uid() OR
    family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )
  );

-- =====================================================
-- PARTE 2: Função SECURITY DEFINER para membros com nomes
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
) SECURITY DEFINER AS $$
DECLARE
  user_uuid UUID;
BEGIN
  user_uuid := auth.uid();

  -- Rejeita chamadas não autenticadas
  IF user_uuid IS NULL THEN
    RETURN;
  END IF;

  -- Segurança: só retorna dados se o caller for membro desta família.
  -- A query roda sem RLS (SECURITY DEFINER), então é verificação real.
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
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_family_members_with_user(UUID) TO authenticated;
