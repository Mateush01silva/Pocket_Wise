-- =============================================================================
-- MIGRATION 037: enable_ai_features — função de habilitação unificada
--
-- USO (SQL Editor do Supabase):
--   SELECT enable_ai_features('email@exemplo.com');
--
-- Essa única chamada:
--   1. Cria/atualiza o registro master em ai_feature_access (enabled=true)
--   2. Habilita 'posso_comprar' em ai_feature_permissions
--   3. Habilita 'assistente'    em ai_feature_permissions
--
-- Idempotente: pode ser rodada várias vezes sem efeito colateral.
-- =============================================================================

CREATE OR REPLACE FUNCTION enable_ai_features(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_access_id UUID;
BEGIN
  -- 1. Garante registro master e recupera o id
  INSERT INTO ai_feature_access (email, enabled)
  VALUES (p_email, true)
  ON CONFLICT (email) DO UPDATE
    SET enabled = true,
        updated_at = NOW()
  RETURNING id INTO v_access_id;

  -- Fallback: ON CONFLICT DO UPDATE também retorna o id; caso raro de race
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

-- =============================================================================
-- SEED: habilitar usuário inicial com todas as funcionalidades
-- =============================================================================
SELECT enable_ai_features('silva.mateush01@gmail.com');
