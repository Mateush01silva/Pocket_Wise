-- ============================================================================
-- MIGRATION: RPC para aceitar convite de família (SECURITY DEFINER)
-- ============================================================================
-- Problema: A política RLS de family_members só permite INSERT para admins.
-- Quando um usuário convidado (não-admin) tenta aceitar o convite, o INSERT
-- é bloqueado pelo RLS.
--
-- Solução: Função SECURITY DEFINER que executa todo o fluxo de aceite com
-- privilégios elevados, validando internamente as regras de negócio.
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_family_invite(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  user_uuid UUID;
  user_email TEXT;
  invite_rec RECORD;
  user_rec RECORD;
  new_member_id UUID;
BEGIN
  -- Validar autenticação
  user_uuid := auth.uid();
  IF user_uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Buscar email do usuário
  SELECT email INTO user_email FROM auth.users WHERE id = user_uuid;

  -- Buscar o convite pelo token
  SELECT * INTO invite_rec FROM family_invites WHERE token = invite_token;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;

  -- Verificar se o email bate
  IF LOWER(invite_rec.invited_email) != LOWER(user_email) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Este convite foi enviado para outro email (' || invite_rec.invited_email || ')'
    );
  END IF;

  -- Verificar status
  IF invite_rec.status != 'pending' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Convite já foi ' || invite_rec.status::TEXT
    );
  END IF;

  -- Verificar expiração
  IF invite_rec.expires_at < NOW() THEN
    UPDATE family_invites SET status = 'expired' WHERE id = invite_rec.id;
    RETURN json_build_object('success', false, 'error', 'Convite expirado');
  END IF;

  -- Verificar se já é membro
  IF EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = invite_rec.family_id AND user_id = user_uuid
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Você já é membro desta família');
  END IF;

  -- Buscar dados atuais do usuário
  SELECT family_id, personal_family_id INTO user_rec FROM users WHERE id = user_uuid;

  -- Atualizar users: definir nova família ativa e preservar pessoal
  IF user_rec.family_id IS NOT NULL AND user_rec.personal_family_id IS NULL THEN
    UPDATE users
    SET family_id = invite_rec.family_id,
        personal_family_id = user_rec.family_id,
        updated_at = NOW()
    WHERE id = user_uuid;
  ELSE
    UPDATE users
    SET family_id = invite_rec.family_id,
        updated_at = NOW()
    WHERE id = user_uuid;
  END IF;

  -- Inserir membro na família
  INSERT INTO family_members (family_id, user_id, role)
  VALUES (invite_rec.family_id, user_uuid, invite_rec.role)
  RETURNING id INTO new_member_id;

  -- Marcar convite como aceito
  UPDATE family_invites
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = user_uuid
  WHERE id = invite_rec.id;

  RETURN json_build_object(
    'success', true,
    'member_id', new_member_id,
    'family_id', invite_rec.family_id,
    'role', invite_rec.role::TEXT
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
