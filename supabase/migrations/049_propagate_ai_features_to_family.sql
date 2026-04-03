-- =============================================================================
-- MIGRATION 049: Propagação automática de AI features para membros da família
--
-- COMPORTAMENTO IMPLEMENTADO:
--   1. Ao habilitar via enable_ai_features(email):
--      → propaga automaticamente para todos os membros da família pessoal do usuário
--
--   2. Ao aceitar um convite (accept_family_invite):
--      → se algum membro da família já tem AI habilitada, o novo membro também recebe
--
--   3. Backfill retroativo:
--      → usuários já habilitados propagam para membros da sua família pessoal
--
-- NOTAS:
--   - Propagação é somente para a família pessoal (personal_family_id), não para
--     famílias onde o usuário foi convidado
--   - Idempotente: pode ser rodada várias vezes sem efeito colateral
--   - Frontend hooks (usePocksAccess, useAssistenteIA, usePossoComprarIA) não
--     precisam de alteração — já consultam ai_feature_access por usuário
-- =============================================================================

-- =============================================================================
-- 1. Função helper: propaga AI features para membros da família pessoal
-- =============================================================================
CREATE OR REPLACE FUNCTION enable_ai_features_for_family_members(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_family_id UUID;
  v_member    RECORD;
  v_count     INTEGER := 0;
BEGIN
  -- Busca a família pessoal do usuário (a que ele próprio criou no signup)
  SELECT personal_family_id INTO v_family_id
    FROM users WHERE id = p_user_id;

  IF v_family_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Habilita AI features para cada membro da família (exceto o próprio usuário)
  FOR v_member IN
    SELECT u.email
      FROM family_members fm
      JOIN users u ON u.id = fm.user_id
     WHERE fm.family_id = v_family_id
       AND fm.user_id  != p_user_id
       AND u.email IS NOT NULL
       AND u.email != ''
  LOOP
    PERFORM enable_ai_features(v_member.email);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- =============================================================================
-- 2. Atualizar enable_ai_features para propagar para membros da família pessoal
--    (mantém toda a lógica atual de 044_*.sql e adiciona a propagação no final)
-- =============================================================================
CREATE OR REPLACE FUNCTION enable_ai_features(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_access_id  UUID;
  v_user_id    UUID;
  v_propagated INTEGER := 0;
BEGIN
  -- Tenta encontrar o user_id pelo email em auth.users
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE email = p_email
   LIMIT 1;

  -- 1. Garante registro master e recupera o id
  INSERT INTO ai_feature_access (email, enabled, user_id)
  VALUES (p_email, true, v_user_id)
  ON CONFLICT (email) DO UPDATE
    SET enabled    = true,
        user_id    = COALESCE(ai_feature_access.user_id, EXCLUDED.user_id),
        updated_at = NOW()
  RETURNING id INTO v_access_id;

  -- Fallback para race condition
  IF v_access_id IS NULL THEN
    SELECT id INTO v_access_id
      FROM ai_feature_access WHERE email = p_email;
  END IF;

  IF v_access_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao obter access_id para email: %', p_email;
  END IF;

  -- 2. Habilita cada funcionalidade (idempotente via ON CONFLICT)
  INSERT INTO ai_feature_permissions (access_id, feature_key, enabled)
  VALUES
    (v_access_id, 'posso_comprar', true),
    (v_access_id, 'assistente',    true)
  ON CONFLICT (access_id, feature_key)
    DO UPDATE SET enabled = true;

  -- 3. Propaga para membros da família pessoal do usuário (se user_id conhecido)
  IF v_user_id IS NOT NULL THEN
    v_propagated := enable_ai_features_for_family_members(v_user_id);
  END IF;

  RETURN format(
    'IA habilitada para %s (access_id: %s, propagado para %s membro(s) da família)',
    p_email, v_access_id, v_propagated
  );
END;
$$;

-- =============================================================================
-- 3. Atualizar accept_family_invite para habilitar AI para novos membros
--    quando a família já possui algum membro com AI habilitada
--    (mantém toda a lógica atual de 023_*.sql e adiciona a checagem após o INSERT)
-- =============================================================================
CREATE OR REPLACE FUNCTION accept_family_invite(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  user_uuid       UUID;
  user_email      TEXT;
  invite_rec      RECORD;
  user_rec        RECORD;
  new_member_id   UUID;
  personal_fam_id UUID;
  v_family_has_ai BOOLEAN;
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

  -- Determinar a família pessoal ANTES de qualquer update
  personal_fam_id := COALESCE(user_rec.personal_family_id, user_rec.family_id);

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

  -- Garantir que a família pessoal tem entrada em family_members como admin
  IF personal_fam_id IS NOT NULL AND personal_fam_id != invite_rec.family_id THEN
    INSERT INTO family_members (family_id, user_id, role)
    SELECT personal_fam_id, user_uuid, 'admin'
    WHERE NOT EXISTS (
      SELECT 1 FROM family_members
      WHERE family_id = personal_fam_id AND user_id = user_uuid
    );
  END IF;

  -- Inserir membro na família convidada
  INSERT INTO family_members (family_id, user_id, role)
  VALUES (invite_rec.family_id, user_uuid, invite_rec.role)
  RETURNING id INTO new_member_id;

  -- -------------------------------------------------------------------------
  -- NOVO: verificar se algum membro da família já tem AI features habilitadas.
  -- Se sim, habilitar automaticamente para o novo membro.
  -- -------------------------------------------------------------------------
  SELECT EXISTS(
    SELECT 1
      FROM family_members fm
      JOIN users u ON u.id = fm.user_id
      JOIN ai_feature_access afa
        ON (afa.user_id = u.id OR afa.email = u.email)
     WHERE fm.family_id = invite_rec.family_id
       AND fm.user_id  != user_uuid   -- exclui o próprio novo membro
       AND afa.enabled  = true
  ) INTO v_family_has_ai;

  IF v_family_has_ai THEN
    PERFORM enable_ai_features(user_email);
  END IF;
  -- -------------------------------------------------------------------------

  -- Marcar convite como aceito
  UPDATE family_invites
  SET status      = 'accepted',
      accepted_at = NOW(),
      accepted_by = user_uuid
  WHERE id = invite_rec.id;

  RETURN json_build_object(
    'success',   true,
    'member_id', new_member_id,
    'family_id', invite_rec.family_id,
    'role',      invite_rec.role::TEXT
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_family_invite(TEXT) TO authenticated;

-- =============================================================================
-- 4. Backfill retroativo
--    Para cada usuário já habilitado, propaga para membros da sua família pessoal
-- =============================================================================
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT afa.user_id
      FROM ai_feature_access afa
     WHERE afa.enabled  = true
       AND afa.user_id IS NOT NULL
  LOOP
    PERFORM enable_ai_features_for_family_members(v_rec.user_id);
  END LOOP;
END;
$$;
