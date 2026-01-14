-- ============================================================================
-- SETUP: Acesso de Administrador
-- ============================================================================
-- Este script adiciona suporte para usuários admin com acesso ilimitado
-- Execute no Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. ADICIONAR COLUNA ROLE NA TABELA USERS
-- ============================================================================

-- Adicionar coluna role se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='role') THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

-- ============================================================================
-- 2. ATUALIZAR FUNÇÃO DE VERIFICAÇÃO DE ACESSO
-- ============================================================================

-- Atualizar função para considerar admins
CREATE OR REPLACE FUNCTION user_has_access(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR(20);
  sub assinaturas%ROWTYPE;
BEGIN
  -- Verificar se é admin
  SELECT role INTO user_role
  FROM users
  WHERE id = user_uuid;

  -- Admins têm acesso ilimitado
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Para usuários normais, verificar assinatura
  SELECT * INTO sub
  FROM assinaturas
  WHERE user_id = user_uuid;

  -- Se não tem assinatura, não tem acesso
  IF sub IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Se está em trial e ainda não expirou
  IF sub.status = 'trial' AND sub.trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;

  -- Se tem assinatura ativa
  IF sub.status = 'active' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. FUNÇÃO: Tornar usuário admin por email
-- ============================================================================

CREATE OR REPLACE FUNCTION make_user_admin(user_email VARCHAR)
RETURNS VOID AS $$
BEGIN
  -- Atualizar role do usuário
  UPDATE users
  SET role = 'admin'
  WHERE email = user_email;

  -- Atualizar ou criar assinatura ativa
  INSERT INTO assinaturas (user_id, status, plan)
  SELECT id, 'active', 'annual'
  FROM users
  WHERE email = user_email
  ON CONFLICT (user_id) DO UPDATE
  SET status = 'active',
      plan = 'annual',
      current_period_start = NOW(),
      current_period_end = NOW() + INTERVAL '100 years',
      updated_at = NOW();

  RAISE NOTICE 'Usuário % agora é admin com acesso ilimitado', user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. COMANDO PARA TORNAR SEU EMAIL ADMIN
-- ============================================================================

-- ⚠️ IMPORTANTE: Substitua 'seu-email@exemplo.com' pelo seu email real
-- Descomente a linha abaixo e execute:

-- SELECT make_user_admin('seu-email@exemplo.com');

-- ============================================================================
-- 5. VERIFICAR ACESSO DE UM USUÁRIO
-- ============================================================================

-- Para verificar se um usuário tem acesso, use:
-- SELECT user_has_access('user_uuid_aqui');

-- Para listar todos os admins:
-- SELECT id, email, role, created_at FROM users WHERE role = 'admin';

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Sistema de admin configurado com sucesso!';
  RAISE NOTICE '📝 Próximos passos:';
  RAISE NOTICE '   1. Execute: SELECT make_user_admin(''seu-email@exemplo.com'');';
  RAISE NOTICE '   2. Substitua pelo seu email real';
  RAISE NOTICE '   3. Você terá acesso ilimitado como admin!';
END $$;
