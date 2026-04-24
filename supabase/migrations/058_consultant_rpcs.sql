-- ============================================================================
-- MIGRATION 058: RPCs para fluxo de Consultor Financeiro
-- Fluxo familiar existente (accept_family_invite) não é modificado
-- ============================================================================

-- ============================================================================
-- RPC: create_consultant_invite
-- Cria um convite do tipo consultor para a família.
-- Valida: apenas 1 consultor ativo por família, apenas admins podem convidar.
-- ============================================================================
CREATE OR REPLACE FUNCTION create_consultant_invite(
  p_family_id           UUID,
  p_invited_email       TEXT,
  p_profile_preset      TEXT,    -- 'configurador' | 'acompanhador'
  p_permissions         JSONB,   -- {"can_create_envelopes": bool, ...}
  p_message             TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_user_id       UUID;
  v_is_admin      BOOLEAN;
  v_active_count  INT;
  v_pending_count INT;
  v_invite_id     UUID;
  v_token         TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Verificar se o usuário é admin da família
  SELECT EXISTS(
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND user_id = v_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Apenas administradores podem convidar consultores');
  END IF;

  -- Verificar se já existe consultor ativo
  SELECT COUNT(*) INTO v_active_count
  FROM family_members
  WHERE family_id = p_family_id AND member_type = 'consultor';

  IF v_active_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Esta família já possui um consultor ativo. Remova o consultor atual antes de adicionar outro.');
  END IF;

  -- Verificar se já existe convite de consultor pendente
  SELECT COUNT(*) INTO v_pending_count
  FROM family_invites
  WHERE family_id = p_family_id
    AND member_type = 'consultor'
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_pending_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Já existe um convite de consultor pendente para esta família.');
  END IF;

  -- Criar o convite (token gerado pelo trigger set_invite_token)
  INSERT INTO family_invites (
    family_id,
    invited_by,
    invited_email,
    role,
    status,
    member_type,
    consultant_permissions,
    message,
    expires_at
  )
  VALUES (
    p_family_id,
    v_user_id,
    lower(trim(p_invited_email)),
    'viewer',               -- consultores sempre entram como viewer
    'pending',
    'consultor',
    p_permissions,
    p_message,
    NOW() + INTERVAL '30 days'  -- convites de consultor têm prazo maior
  )
  RETURNING id, token INTO v_invite_id, v_token;

  RETURN json_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'token', v_token
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_consultant_invite(UUID, TEXT, TEXT, JSONB, TEXT) TO authenticated;

-- ============================================================================
-- RPC: accept_consultant_invite
-- Fluxo paralelo ao accept_family_invite, exclusivo para convites de consultor.
-- O accept_family_invite original NÃO é modificado.
-- ============================================================================
CREATE OR REPLACE FUNCTION accept_consultant_invite(p_invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_user_id         UUID;
  v_user_email      TEXT;
  v_invite          RECORD;
  v_existing_member UUID;
  v_old_family_id   UUID;
  v_member_id       UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Buscar email do usuário autenticado
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Buscar o convite pelo token
  SELECT * INTO v_invite
  FROM family_invites
  WHERE token = p_invite_token;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;

  -- Validar que é um convite de consultor
  IF v_invite.member_type != 'consultor' THEN
    RETURN json_build_object('success', false, 'error', 'Este convite não é para consultor');
  END IF;

  -- Validar email (case-insensitive)
  IF lower(v_user_email) != lower(v_invite.invited_email) THEN
    RETURN json_build_object('success', false, 'error', 'Este convite foi enviado para outro email');
  END IF;

  -- Validar status
  IF v_invite.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Este convite já foi utilizado ou expirou');
  END IF;

  -- Validar expiração
  IF v_invite.expires_at < NOW() THEN
    UPDATE family_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN json_build_object('success', false, 'error', 'Este convite expirou');
  END IF;

  -- Verificar se já é membro desta família
  SELECT id INTO v_existing_member
  FROM family_members
  WHERE family_id = v_invite.family_id AND user_id = v_user_id;

  IF v_existing_member IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Você já é membro desta família');
  END IF;

  -- Verificar limite de 1 consultor por família
  IF EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = v_invite.family_id AND member_type = 'consultor'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Esta família já possui um consultor ativo');
  END IF;

  -- Preservar família pessoal do consultor (mesma lógica do accept_family_invite)
  SELECT family_id INTO v_old_family_id FROM users WHERE id = v_user_id;

  UPDATE users
  SET
    personal_family_id = CASE
      WHEN personal_family_id IS NULL AND v_old_family_id IS NOT NULL THEN v_old_family_id
      ELSE personal_family_id
    END,
    family_id = v_invite.family_id,
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Adicionar como membro com role='viewer' e member_type='consultor'
  INSERT INTO family_members (family_id, user_id, role, member_type)
  VALUES (v_invite.family_id, v_user_id, 'viewer', 'consultor')
  RETURNING id INTO v_member_id;

  -- Criar as permissões do consultor a partir do JSONB armazenado no convite
  INSERT INTO consultant_permissions (
    family_member_id,
    family_id,
    can_create_envelopes,
    can_create_categories,
    can_manage_accounts,
    can_view_envelopes,
    can_view_pocks,
    can_view_caixinhas,
    profile_preset
  )
  VALUES (
    v_member_id,
    v_invite.family_id,
    COALESCE((v_invite.consultant_permissions->>'can_create_envelopes')::boolean, false),
    COALESCE((v_invite.consultant_permissions->>'can_create_categories')::boolean, false),
    COALESCE((v_invite.consultant_permissions->>'can_manage_accounts')::boolean, false),
    COALESCE((v_invite.consultant_permissions->>'can_view_envelopes')::boolean, true),
    COALESCE((v_invite.consultant_permissions->>'can_view_pocks')::boolean, true),
    COALESCE((v_invite.consultant_permissions->>'can_view_caixinhas')::boolean, true),
    v_invite.consultant_permissions->>'profile_preset'
  );

  -- Marcar convite como aceito
  UPDATE family_invites
  SET
    status = 'accepted',
    accepted_at = NOW(),
    accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN json_build_object(
    'success', true,
    'family_id', v_invite.family_id,
    'member_id', v_member_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_consultant_invite(TEXT) TO authenticated, anon;

-- ============================================================================
-- RPC: update_consultant_permissions
-- Admin atualiza permissões de um consultor ativo.
-- ============================================================================
CREATE OR REPLACE FUNCTION update_consultant_permissions(
  p_family_member_id  UUID,
  p_permissions       JSONB
)
RETURNS JSON AS $$
DECLARE
  v_user_id    UUID;
  v_family_id  UUID;
  v_is_admin   BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Buscar family_id do membro
  SELECT family_id INTO v_family_id
  FROM family_members
  WHERE id = p_family_member_id AND member_type = 'consultor';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Consultor não encontrado');
  END IF;

  -- Verificar se o usuário é admin da família
  SELECT EXISTS(
    SELECT 1 FROM family_members
    WHERE family_id = v_family_id AND user_id = v_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Apenas administradores podem editar permissões');
  END IF;

  -- Atualizar permissões
  UPDATE consultant_permissions
  SET
    can_create_envelopes  = COALESCE((p_permissions->>'can_create_envelopes')::boolean, can_create_envelopes),
    can_create_categories = COALESCE((p_permissions->>'can_create_categories')::boolean, can_create_categories),
    can_manage_accounts   = COALESCE((p_permissions->>'can_manage_accounts')::boolean, can_manage_accounts),
    can_view_envelopes    = COALESCE((p_permissions->>'can_view_envelopes')::boolean, can_view_envelopes),
    can_view_pocks        = COALESCE((p_permissions->>'can_view_pocks')::boolean, can_view_pocks),
    can_view_caixinhas    = COALESCE((p_permissions->>'can_view_caixinhas')::boolean, can_view_caixinhas),
    profile_preset        = COALESCE(p_permissions->>'profile_preset', profile_preset),
    updated_at            = NOW()
  WHERE family_member_id = p_family_member_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_consultant_permissions(UUID, JSONB) TO authenticated;

-- ============================================================================
-- RPC: get_consultant_permissions
-- Retorna as permissões do consultor da família ativa do usuário.
-- Chamado tanto pelo admin quanto pelo próprio consultor.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_consultant_permissions(p_family_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_result  RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Verificar se o usuário pertence a esta família (admin ou consultor)
  IF NOT EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = p_family_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  SELECT
    cp.id,
    cp.family_member_id,
    cp.family_id,
    cp.can_create_envelopes,
    cp.can_create_categories,
    cp.can_manage_accounts,
    cp.can_view_envelopes,
    cp.can_view_pocks,
    cp.can_view_caixinhas,
    cp.profile_preset,
    fm.user_id as consultant_user_id,
    u.nome as consultant_name
  INTO v_result
  FROM consultant_permissions cp
  JOIN family_members fm ON fm.id = cp.family_member_id
  JOIN users u ON u.id = fm.user_id
  WHERE cp.family_id = p_family_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', true, 'data', NULL);
  END IF;

  RETURN json_build_object(
    'success', true,
    'data', row_to_json(v_result)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_consultant_permissions(UUID) TO authenticated;

-- ============================================================================
-- RPC: get_invite_by_token — extensão do existente via nova função
-- A função original get_invite_by_token não é modificada.
-- Esta nova versão retorna também os campos de consultor.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_invite_by_token(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Marcar expirados primeiro
  UPDATE family_invites
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();

  SELECT
    fi.id,
    fi.family_id,
    fi.invited_by,
    fi.invited_email,
    fi.token,
    fi.role,
    fi.status,
    fi.message,
    fi.expires_at,
    fi.accepted_at,
    fi.accepted_by,
    fi.created_at,
    fi.member_type,
    fi.consultant_permissions,
    f.nome as family_name,
    u.nome as invited_by_name,
    au.email as invited_by_email
  INTO v_invite
  FROM family_invites fi
  JOIN families f ON fi.family_id = f.id
  JOIN users u ON fi.invited_by = u.id
  JOIN auth.users au ON u.id = au.id
  WHERE fi.token = invite_token;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;

  IF v_invite.status = 'expired' THEN
    RETURN json_build_object('success', false, 'error', 'Este convite expirou');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Este convite já foi utilizado');
  END IF;

  RETURN json_build_object('success', true, 'data', row_to_json(v_invite));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_invite_by_token(TEXT) TO authenticated, anon;

-- ============================================================================
-- FIM DA MIGRATION 058
-- ============================================================================
