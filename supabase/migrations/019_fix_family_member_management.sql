-- ============================================================================
-- MIGRATION 019: Correções para gerenciamento de membros da família
-- ============================================================================
--
-- PROBLEMAS CORRIGIDOS:
--
-- 1. INSERT RLS circular: A política "Admins can insert family members" verifica
--    se o usuário já é admin em family_members, mas quando a família acaba de
--    ser criada não há nenhuma linha ainda. Resultado: o criador nunca consegue
--    ser adicionado como admin via INSERT direto do cliente.
--
-- 2. Criadores ausentes: Consequência do problema 1 — quem criou a família
--    APÓS a migration 005 não está na tabela family_members. Isso faz com que
--    isAdmin() retorne false no frontend → seletor de role não aparece.
--
-- 3. RPCs sem GRANT: As funções de 018 não tinham GRANT EXECUTE para o role
--    'authenticated', então podem estar inacessíveis via SDK do cliente.
--
-- 4. personal_family_id inexistente: Se a migration 016 não foi aplicada,
--    a coluna personal_family_id não existe e a RPC 018 falha com erro SQL.
-- ============================================================================

-- ============================================================================
-- 1. Garantir que personal_family_id existe (idempotent)
-- ============================================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS personal_family_id UUID REFERENCES families(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. Corrigir a política INSERT de family_members (remover o problema circular)
--    Adicionar exceção para o dono da família poder adicionar o primeiro membro.
-- ============================================================================
DROP POLICY IF EXISTS "Admins can insert family members" ON family_members;

CREATE POLICY "Admins can insert family members"
  ON family_members FOR INSERT
  WITH CHECK (
    -- O dono da família pode sempre inserir membros (necessário para o primeiro INSERT)
    EXISTS (
      SELECT 1 FROM families
      WHERE id = family_members.family_id
        AND owner_id = auth.uid()
    )
    OR
    -- Admins existentes também podem inserir
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.user_id = auth.uid()
        AND fm.family_id = family_members.family_id
        AND fm.role = 'admin'
    )
  );

-- ============================================================================
-- 3. Inserir criadores ausentes em family_members
--    Cobre qualquer família cujo owner_id não tem entrada como admin.
--    Idempotente graças ao NOT EXISTS.
-- ============================================================================
INSERT INTO family_members (family_id, user_id, role)
SELECT f.id, f.owner_id, 'admin'::family_role
FROM families f
WHERE f.owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM family_members fm
    WHERE fm.family_id = f.id
      AND fm.user_id = f.owner_id
  );

-- ============================================================================
-- 4. Popular personal_family_id para donos de família que ainda não têm
-- ============================================================================
UPDATE users u
SET personal_family_id = (
  SELECT f.id FROM families f WHERE f.owner_id = u.id LIMIT 1
)
WHERE u.personal_family_id IS NULL
  AND EXISTS (SELECT 1 FROM families f WHERE f.owner_id = u.id);

-- ============================================================================
-- 5. Recriar a RPC remove_family_member de forma mais robusta
--    - Usa NULL em vez de personal_family_id diretamente no UPDATE
--      (mais seguro: restaura para personal_family_id se existir, senão NULL)
--    - Valida admin também pelo families.owner_id como fallback
-- ============================================================================
CREATE OR REPLACE FUNCTION remove_family_member(member_id UUID)
RETURNS JSON AS $$
DECLARE
  caller_uuid UUID;
  member_rec RECORD;
  admin_count INT;
  restore_family_id UUID;
  is_caller_admin BOOLEAN := false;
BEGIN
  caller_uuid := auth.uid();
  IF caller_uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Buscar o membro a ser removido
  SELECT * INTO member_rec FROM family_members WHERE id = member_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Membro não encontrado');
  END IF;

  -- Não permitir auto-remoção
  IF member_rec.user_id = caller_uuid THEN
    RETURN json_build_object('success', false, 'error', 'Você não pode remover a si mesmo');
  END IF;

  -- Verificar se o solicitante é admin desta família
  -- Aceita tanto via family_members quanto via families.owner_id (fallback)
  SELECT EXISTS (
    SELECT 1 FROM family_members fm
    WHERE fm.family_id = member_rec.family_id
      AND fm.user_id = caller_uuid
      AND fm.role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM families f
    WHERE f.id = member_rec.family_id
      AND f.owner_id = caller_uuid
  ) INTO is_caller_admin;

  IF NOT is_caller_admin THEN
    RETURN json_build_object('success', false, 'error', 'Apenas admins podem remover membros');
  END IF;

  -- Não permitir remover o último admin
  IF member_rec.role = 'admin' THEN
    SELECT COUNT(*) INTO admin_count FROM family_members
    WHERE family_id = member_rec.family_id AND role = 'admin';
    IF admin_count <= 1 THEN
      RETURN json_build_object('success', false, 'error', 'Não é possível remover o único admin da família');
    END IF;
  END IF;

  -- Determinar para qual família restaurar o usuário removido
  -- Se ele tem uma família pessoal diferente, restaura; senão, NULL
  BEGIN
    SELECT personal_family_id INTO restore_family_id
    FROM users WHERE id = member_rec.user_id;
    -- Se personal_family_id é a mesma que está sendo removido, vai para NULL
    IF restore_family_id = member_rec.family_id THEN
      restore_family_id := NULL;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    -- Coluna personal_family_id não existe: apenas setar NULL
    restore_family_id := NULL;
  END;

  -- Atualizar family_id do usuário removido
  UPDATE users
  SET family_id = restore_family_id,
      updated_at = NOW()
  WHERE id = member_rec.user_id;

  -- Remover da tabela family_members
  DELETE FROM family_members WHERE id = member_id;

  RETURN json_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Recriar a RPC update_member_role de forma mais robusta
--    - Valida admin também pelo families.owner_id como fallback
-- ============================================================================
CREATE OR REPLACE FUNCTION update_member_role(member_id UUID, new_role TEXT)
RETURNS JSON AS $$
DECLARE
  caller_uuid UUID;
  member_rec RECORD;
  admin_count INT;
  is_caller_admin BOOLEAN := false;
BEGIN
  caller_uuid := auth.uid();
  IF caller_uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Validar o valor do role
  IF new_role NOT IN ('admin', 'editor', 'viewer') THEN
    RETURN json_build_object('success', false, 'error', 'Permissão inválida. Use: admin, editor ou viewer');
  END IF;

  -- Buscar o membro
  SELECT * INTO member_rec FROM family_members WHERE id = member_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Membro não encontrado');
  END IF;

  -- Verificar se o solicitante é admin (family_members OU owner_id)
  SELECT EXISTS (
    SELECT 1 FROM family_members fm
    WHERE fm.family_id = member_rec.family_id
      AND fm.user_id = caller_uuid
      AND fm.role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM families f
    WHERE f.id = member_rec.family_id
      AND f.owner_id = caller_uuid
  ) INTO is_caller_admin;

  IF NOT is_caller_admin THEN
    RETURN json_build_object('success', false, 'error', 'Apenas admins podem alterar permissões');
  END IF;

  -- Se está rebaixando um admin, verificar se há outro
  IF member_rec.role = 'admin' AND new_role != 'admin' THEN
    SELECT COUNT(*) INTO admin_count FROM family_members
    WHERE family_id = member_rec.family_id AND role = 'admin';
    IF admin_count <= 1 THEN
      RETURN json_build_object('success', false, 'error', 'Não é possível rebaixar o único admin da família');
    END IF;
  END IF;

  -- Atualizar a role
  UPDATE family_members
  SET role = new_role::family_role,
      updated_at = NOW()
  WHERE id = member_id;

  RETURN json_build_object('success', true, 'role', new_role);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Garantir GRANT EXECUTE para usuários autenticados
-- ============================================================================
GRANT EXECUTE ON FUNCTION remove_family_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_member_role(UUID, TEXT) TO authenticated;
