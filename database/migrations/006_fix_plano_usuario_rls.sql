-- ============================================================================
-- Fix: Garantir políticas RLS corretas em plano_usuario e users
-- ============================================================================
-- Execute este script no Supabase SQL Editor.
-- É idempotente — pode ser rodado múltiplas vezes sem problemas.
-- ============================================================================


-- 1. Usuários podem ler o próprio plano (ESSENCIAL — sem isso o login trava)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'plano_usuario'
      AND policyname = 'users_can_read_own_plan'
  ) THEN
    CREATE POLICY "users_can_read_own_plan"
      ON plano_usuario FOR SELECT
      USING (auth.uid() = user_id);
    RAISE NOTICE '✅ Criada: users_can_read_own_plan (plano_usuario)';
  ELSE
    RAISE NOTICE '✔ Já existe: users_can_read_own_plan (plano_usuario)';
  END IF;
END $$;


-- 2. Admin pode ler todos os planos (necessário para AdminUsuarios.tsx)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'plano_usuario'
      AND policyname = 'admin_can_select_plano_usuario'
  ) THEN
    CREATE POLICY "admin_can_select_plano_usuario"
      ON plano_usuario FOR SELECT
      USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
    RAISE NOTICE '✅ Criada: admin_can_select_plano_usuario (plano_usuario)';
  ELSE
    RAISE NOTICE '✔ Já existe: admin_can_select_plano_usuario (plano_usuario)';
  END IF;
END $$;


-- 3. Admin pode atualizar planos de qualquer usuário
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'plano_usuario'
      AND policyname = 'admin_can_update_plano_usuario'
  ) THEN
    CREATE POLICY "admin_can_update_plano_usuario"
      ON plano_usuario FOR UPDATE
      USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
    RAISE NOTICE '✅ Criada: admin_can_update_plano_usuario (plano_usuario)';
  ELSE
    RAISE NOTICE '✔ Já existe: admin_can_update_plano_usuario (plano_usuario)';
  END IF;
END $$;


-- 4. Admin pode ler todos os perfis de usuário (necessário para busca por email)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'admin_can_select_users'
  ) THEN
    CREATE POLICY "admin_can_select_users"
      ON users FOR SELECT
      USING ((SELECT role FROM users u2 WHERE u2.id = auth.uid()) = 'admin');
    RAISE NOTICE '✅ Criada: admin_can_select_users (users)';
  ELSE
    RAISE NOTICE '✔ Já existe: admin_can_select_users (users)';
  END IF;
END $$;


-- Verificação final — mostra todas as políticas criadas
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  tablename,
  policyname,
  cmd AS operacao
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('plano_usuario', 'users')
ORDER BY tablename, policyname;
