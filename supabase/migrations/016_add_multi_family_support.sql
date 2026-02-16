-- ============================================================================
-- MIGRATION: Suporte a múltiplas famílias por usuário
-- ============================================================================
-- Problema: users.family_id é o campo usado por TODAS as RLS policies.
-- Um usuário só pode ver dados de UMA família por vez.
--
-- Solução: adicionar personal_family_id para guardar a família própria do
-- usuário, enquanto family_id fica como a "família ativa" (pode ser trocada).
-- O switch de família é feito via RPC segura (usa auth.uid()).
-- ============================================================================

-- 1. Adicionar coluna personal_family_id
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS personal_family_id UUID REFERENCES families(id) ON DELETE SET NULL;

-- 2. Popular personal_family_id para usuários existentes que já têm family_id
--    (se já pertencem a uma família como admin, essa é a pessoal deles)
UPDATE users u
SET personal_family_id = u.family_id
WHERE u.family_id IS NOT NULL
  AND u.personal_family_id IS NULL
  AND EXISTS (
    SELECT 1 FROM family_members fm
    WHERE fm.family_id = u.family_id
      AND fm.user_id = u.id
      AND fm.role = 'admin'
  );

-- ============================================================================
-- RPC: get_user_families
-- Retorna todas as famílias que o usuário pertence (via family_members).
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_families()
RETURNS JSON AS $$
DECLARE
  user_uuid UUID;
  result JSON;
BEGIN
  user_uuid := auth.uid();
  IF user_uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  SELECT json_build_object(
    'success', true,
    'families', COALESCE(json_agg(
      json_build_object(
        'family_id', f.id,
        'nome', f.nome,
        'role', fm.role,
        'is_personal', (u.personal_family_id = f.id)
      )
      ORDER BY (u.personal_family_id = f.id) DESC, f.nome
    ), '[]'::json),
    'active_family_id', u.family_id,
    'personal_family_id', u.personal_family_id
  )
  INTO result
  FROM family_members fm
  JOIN families f ON f.id = fm.family_id
  JOIN users u ON u.id = user_uuid
  WHERE fm.user_id = user_uuid;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC: switch_active_family
-- Troca a família ativa do usuário (users.family_id).
-- Valida que o usuário realmente pertence à família alvo.
-- Isso muda o contexto de dados vistos em toda a aplicação (via RLS).
-- ============================================================================
CREATE OR REPLACE FUNCTION switch_active_family(target_family_id UUID)
RETURNS JSON AS $$
DECLARE
  user_uuid UUID;
  is_member BOOLEAN;
  family_name TEXT;
BEGIN
  user_uuid := auth.uid();
  IF user_uuid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Verificar que o usuário é membro da família alvo
  SELECT EXISTS(
    SELECT 1 FROM family_members
    WHERE family_id = target_family_id AND user_id = user_uuid
  ) INTO is_member;

  IF NOT is_member THEN
    RETURN json_build_object('success', false, 'error', 'Você não é membro desta família');
  END IF;

  -- Buscar nome da família para retornar
  SELECT nome INTO family_name FROM families WHERE id = target_family_id;

  -- Trocar família ativa
  UPDATE users
  SET family_id = target_family_id,
      updated_at = NOW()
  WHERE id = user_uuid;

  RETURN json_build_object(
    'success', true,
    'family_id', target_family_id,
    'nome', family_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
