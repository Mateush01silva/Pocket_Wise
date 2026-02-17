-- ============================================================================
-- MIGRATION 023: Corrigir FamilySwitcher para membros convidados
-- ============================================================================
--
-- PROBLEMA RAIZ:
--   O trigger handle_new_user (migration 014) cria uma família para cada novo
--   usuário e define users.family_id, mas NÃO insere em family_members.
--   Consequência: usuários que se cadastraram após a migration 019 não têm
--   linha em family_members para sua família pessoal.
--
--   Quando aceitam um convite (accept_family_invite), ganham uma entrada em
--   family_members APENAS para a família convidada. Como get_user_families
--   busca somente via family_members, retorna 1 família → FamilySwitcher
--   nunca aparece (só mostra quando userFamilies.length > 1).
--
-- CORREÇÕES:
--   1. Trigger handle_new_user: também insere em family_members como admin.
--   2. accept_family_invite: garante entrada em family_members p/ família pessoal.
--   3. get_user_families: usa UNION para incluir família pessoal como fallback.
--   4. switch_active_family: permite trocar para família pessoal mesmo sem
--      entrada em family_members (compatibilidade retroativa).
--   5. Backfill de dados: insere family_members para usuários já existentes.
-- ============================================================================

-- ============================================================================
-- 1. Atualizar handle_new_user para inserir em family_members
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_family_id UUID;
  user_name TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário');

  -- 1. Criar uma nova família para o usuário
  INSERT INTO public.families (nome)
  VALUES ('Família de ' || user_name)
  RETURNING id INTO new_family_id;

  -- 2. Criar perfil do usuário com family_id e personal_family_id
  INSERT INTO public.users (id, email, nome, full_name, family_id, personal_family_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    user_name,
    user_name,
    new_family_id,
    new_family_id   -- personal_family_id sempre igual à família criada no signup
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      nome = EXCLUDED.nome,
      full_name = EXCLUDED.full_name,
      family_id = COALESCE(users.family_id, EXCLUDED.family_id),
      personal_family_id = COALESCE(users.personal_family_id, EXCLUDED.personal_family_id);

  -- 3. Inserir o usuário como admin da própria família
  INSERT INTO public.family_members (family_id, user_id, role)
  VALUES (new_family_id, NEW.id, 'admin')
  ON CONFLICT DO NOTHING;

  -- 4. Criar plano trial de 7 dias
  INSERT INTO public.plano_usuario (user_id, status, trial_ends_at)
  VALUES (
    NEW.id,
    'trial',
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE handle_new_user();

-- ============================================================================
-- 2. Atualizar accept_family_invite para garantir family_members da família pessoal
-- ============================================================================
CREATE OR REPLACE FUNCTION accept_family_invite(invite_token TEXT)
RETURNS JSON AS $$
DECLARE
  user_uuid UUID;
  user_email TEXT;
  invite_rec RECORD;
  user_rec RECORD;
  new_member_id UUID;
  personal_fam_id UUID;
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
  -- (pode estar ausente se o usuário se cadastrou após as migrations 016/019)
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

GRANT EXECUTE ON FUNCTION accept_family_invite(TEXT) TO authenticated;

-- ============================================================================
-- 3. Atualizar get_user_families com UNION (família pessoal como fallback)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_families()
RETURNS JSON AS $$
DECLARE
  user_uuid UUID;
  user_rec RECORD;
  families_json JSON;
BEGIN
  user_uuid := auth.uid();
  IF user_uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Buscar dados do usuário
  SELECT family_id, personal_family_id INTO user_rec FROM users WHERE id = user_uuid;

  -- Buscar famílias: via family_members + fallback para família pessoal sem entrada
  SELECT COALESCE(json_agg(
    json_build_object(
      'family_id', fam.family_id,
      'nome',      fam.nome,
      'role',      fam.role,
      'is_personal', fam.is_personal
    )
    ORDER BY fam.is_personal DESC, fam.nome
  ), '[]'::json)
  INTO families_json
  FROM (
    -- Famílias onde o usuário tem entrada em family_members
    SELECT
      f.id                              AS family_id,
      f.nome,
      fm.role::TEXT                     AS role,
      (user_rec.personal_family_id = f.id) AS is_personal
    FROM family_members fm
    JOIN families f ON f.id = fm.family_id
    WHERE fm.user_id = user_uuid

    UNION

    -- Família pessoal como fallback (caso não exista em family_members)
    -- Cobre usuários que se cadastraram antes desta migration ser aplicada
    SELECT
      f.id    AS family_id,
      f.nome,
      'admin' AS role,
      true    AS is_personal
    FROM families f
    WHERE f.id = user_rec.personal_family_id
      AND user_rec.personal_family_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM family_members fm2
        WHERE fm2.user_id = user_uuid
          AND fm2.family_id = user_rec.personal_family_id
      )
  ) AS fam;

  RETURN json_build_object(
    'success',           true,
    'families',          families_json,
    'active_family_id',  user_rec.family_id,
    'personal_family_id', user_rec.personal_family_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_families() TO authenticated;

-- ============================================================================
-- 4. Atualizar switch_active_family para permitir trocar para família pessoal
--    mesmo sem entrada em family_members (compatibilidade retroativa)
-- ============================================================================
CREATE OR REPLACE FUNCTION switch_active_family(target_family_id UUID)
RETURNS JSON AS $$
DECLARE
  user_uuid UUID;
  user_rec  RECORD;
  is_member BOOLEAN;
  family_name TEXT;
BEGIN
  user_uuid := auth.uid();
  IF user_uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT family_id, personal_family_id INTO user_rec FROM users WHERE id = user_uuid;

  -- Verificar que o usuário é membro da família alvo via family_members
  -- OU que a família alvo é a sua família pessoal (fallback retroativo)
  SELECT EXISTS(
    SELECT 1 FROM family_members
    WHERE family_id = target_family_id AND user_id = user_uuid
    UNION
    SELECT 1 FROM (SELECT 1) x
    WHERE user_rec.personal_family_id = target_family_id
  ) INTO is_member;

  IF NOT is_member THEN
    RETURN json_build_object('success', false, 'error', 'Você não é membro desta família');
  END IF;

  -- Buscar nome da família
  SELECT nome INTO family_name FROM families WHERE id = target_family_id;

  -- Trocar família ativa
  UPDATE users
  SET family_id = target_family_id,
      updated_at = NOW()
  WHERE id = user_uuid;

  RETURN json_build_object(
    'success',   true,
    'family_id', target_family_id,
    'nome',      family_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION switch_active_family(UUID) TO authenticated;

-- ============================================================================
-- 5. Backfill: garantir family_members para todos os usuários existentes
--    que têm personal_family_id mas não têm entrada em family_members
-- ============================================================================
INSERT INTO family_members (family_id, user_id, role)
SELECT u.personal_family_id, u.id, 'admin'
FROM users u
WHERE u.personal_family_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM family_members fm
    WHERE fm.family_id = u.personal_family_id
      AND fm.user_id = u.id
  );

-- Para usuários sem personal_family_id mas com family_id (e sem family_members)
-- trata o family_id atual como família pessoal e garante entrada
INSERT INTO family_members (family_id, user_id, role)
SELECT u.family_id, u.id, 'admin'
FROM users u
WHERE u.personal_family_id IS NULL
  AND u.family_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM family_members fm
    WHERE fm.family_id = u.family_id
      AND fm.user_id = u.id
  );

-- Também garantir que personal_family_id está preenchido para esses usuários
UPDATE users u
SET personal_family_id = u.family_id
WHERE u.personal_family_id IS NULL
  AND u.family_id IS NOT NULL;
