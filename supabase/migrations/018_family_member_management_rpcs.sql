-- ============================================================================
-- MIGRATION: RPCs para gerenciar membros da família (SECURITY DEFINER)
-- ============================================================================
-- Problema: A RLS da tabela users permite que cada usuário atualize
-- apenas o próprio perfil. Quando um admin remove um membro, o UPDATE em
-- users.family_id = null falha silenciosamente (sem afetar a linha),
-- deixando o usuário removido ainda "apontando" para a família.
--
-- Solução: Funções SECURITY DEFINER que validam permissões internamente
-- e executam as operações sem as restrições de RLS.
-- ============================================================================

-- ============================================================================
-- RPC: remove_family_member
-- Remove um membro da família e limpa seu family_id no users.
-- Valida que o solicitante é admin e que o membro pertence à família.
-- ============================================================================
CREATE OR REPLACE FUNCTION remove_family_member(member_id UUID)
RETURNS JSON AS $$
DECLARE
  caller_uuid UUID;
  member_rec RECORD;
  admin_rec RECORD;
  admin_count INT;
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
  SELECT * INTO admin_rec FROM family_members
  WHERE family_id = member_rec.family_id AND user_id = caller_uuid AND role = 'admin';
  IF NOT FOUND THEN
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

  -- Restaurar family_id do usuário removido para sua família pessoal (se houver),
  -- ou setar null se não tiver família pessoal
  UPDATE users
  SET family_id = COALESCE(personal_family_id, NULL),
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
-- RPC: update_member_role
-- Altera a role de um membro da família.
-- Valida que o solicitante é admin e protege o último admin.
-- ============================================================================
CREATE OR REPLACE FUNCTION update_member_role(member_id UUID, new_role TEXT)
RETURNS JSON AS $$
DECLARE
  caller_uuid UUID;
  member_rec RECORD;
  admin_count INT;
BEGIN
  caller_uuid := auth.uid();
  IF caller_uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Validar o valor do role
  IF new_role NOT IN ('admin', 'editor', 'viewer') THEN
    RETURN json_build_object('success', false, 'error', 'Role inválido');
  END IF;

  -- Buscar o membro
  SELECT * INTO member_rec FROM family_members WHERE id = member_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Membro não encontrado');
  END IF;

  -- Verificar se o solicitante é admin desta família
  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = member_rec.family_id AND user_id = caller_uuid AND role = 'admin'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Apenas admins podem alterar permissões');
  END IF;

  -- Se está rebaixando um admin, verificar se há outro admin
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
