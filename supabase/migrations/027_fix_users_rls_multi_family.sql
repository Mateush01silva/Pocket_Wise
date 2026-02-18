-- Migration 027: Atualizar policy RLS de users para multi-família
-- ============================================================================
--
-- PROBLEMA:
--   A policy "Users can view family members" em users usa:
--     id = auth.uid() OR family_id IN (SELECT family_id FROM users WHERE id = auth.uid())
--
--   Isso só deixa ver usuários cuja users.family_id coincide com a família
--   ativa do usuário logado. Em um sistema multi-família, membros convidados
--   podem ter users.family_id apontando para a família pessoal deles (diferente
--   da família ativa do admin), então a policy os bloqueia — o nome some na UI.
--
-- SOLUÇÃO:
--   Adicionar terceira condição: "posso ver usuários que são membros da mesma
--   família ativa que eu, via tabela family_members."
--
--   A family_members tem sua própria RLS que já filtra por família ativa,
--   então a condição adicional é segura e não vaza dados de outras famílias.
-- ============================================================================

DROP POLICY IF EXISTS "Users can view family members" ON users;

CREATE POLICY "Users can view family members"
  ON users FOR SELECT
  USING (
    -- Sempre pode ver a si mesmo
    id = auth.uid()

    -- Pode ver usuários cuja família ativa (users.family_id) é igual à sua
    OR family_id IN (
      SELECT family_id FROM users WHERE id = auth.uid()
    )

    -- Pode ver usuários que são membros da mesma família ativa (via family_members).
    -- Cobre membros cujo users.family_id aponta para outra família (ex: família pessoal).
    -- A RLS de family_members já restringe ao contexto da família ativa, então
    -- não há vazamento de dados de famílias alheias.
    OR id IN (
      SELECT fm.user_id
      FROM family_members fm
      WHERE fm.family_id IN (
        SELECT fm2.family_id
        FROM family_members fm2
        WHERE fm2.user_id = auth.uid()
      )
    )
  );
