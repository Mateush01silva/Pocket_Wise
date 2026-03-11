-- =============================================================================
-- MIGRATION 044: Corrige RLS e vincula user_id em ai_feature_access
--
-- PROBLEMAS RESOLVIDOS:
--   1. Registros criados via seed/enable_ai_features tinham user_id = NULL
--      → RLS "auth.uid() = user_id" retornava FALSE → frontend mostrava
--      "Assistente em breve" mesmo para usuários habilitados.
--
--   2. ai_feature_permissions não tinha política para o papel 'authenticated'
--      → frontend não conseguia ler as permissões por feature_key.
--
-- FIXES:
--   A. Vincula user_id para registros existentes usando auth.users por email.
--   B. Adiciona RLS por email (JWT) como fallback para registros novos.
--   C. Adiciona RLS em ai_feature_permissions para authenticated via access_id.
--   D. Atualiza enable_ai_features para vincular user_id na criação.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Vincula user_id para todos os registros que ainda têm user_id = NULL
-- -----------------------------------------------------------------------------
UPDATE ai_feature_access afa
SET
  user_id    = u.id,
  updated_at = NOW()
FROM auth.users u
WHERE afa.email = u.email
  AND afa.user_id IS NULL;

-- -----------------------------------------------------------------------------
-- B. Adiciona RLS por email (JWT) em ai_feature_access
--    Cobre o caso em que user_id ainda está NULL (entre seed e primeiro login)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_feature_access: lookup por email jwt" ON ai_feature_access;

CREATE POLICY "ai_feature_access: lookup por email jwt"
  ON ai_feature_access FOR SELECT
  USING (email = (auth.jwt() ->> 'email'));

-- -----------------------------------------------------------------------------
-- C. Permite que usuários autenticados leiam suas próprias permissões
--    (necessário para o frontend verificar feature_key = 'assistente')
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ai_feature_permissions: authenticated lê as próprias" ON ai_feature_permissions;

CREATE POLICY "ai_feature_permissions: authenticated lê as próprias"
  ON ai_feature_permissions FOR SELECT
  TO authenticated
  USING (
    access_id IN (
      SELECT id
        FROM ai_feature_access
       WHERE user_id = auth.uid()
          OR email   = (auth.jwt() ->> 'email')
    )
  );

-- -----------------------------------------------------------------------------
-- D. Atualiza enable_ai_features para vincular user_id quando o usuário
--    já existe em auth.users (idempotente)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enable_ai_features(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_access_id UUID;
  v_user_id   UUID;
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

  RETURN format('IA habilitada para %s (access_id: %s)', p_email, v_access_id);
END;
$$;

-- Re-executa para o usuário seed (vincula user_id caso ainda esteja NULL)
SELECT enable_ai_features('silva.mateush01@gmail.com');
