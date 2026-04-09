-- Admin RLS policies for plan management and user search
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  -- Admin pode ler todos os planos de usuários
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'plano_usuario'
      AND policyname = 'admin_can_select_plano_usuario'
  ) THEN
    CREATE POLICY "admin_can_select_plano_usuario"
      ON plano_usuario FOR SELECT
      USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
  END IF;

  -- Admin pode atualizar planos de qualquer usuário
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'plano_usuario'
      AND policyname = 'admin_can_update_plano_usuario'
  ) THEN
    CREATE POLICY "admin_can_update_plano_usuario"
      ON plano_usuario FOR UPDATE
      USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');
  END IF;

  -- Admin pode ler dados de qualquer usuário (busca por email)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users'
      AND policyname = 'admin_can_select_users'
  ) THEN
    CREATE POLICY "admin_can_select_users"
      ON users FOR SELECT
      USING ((SELECT role FROM users u2 WHERE u2.id = auth.uid()) = 'admin');
  END IF;
END $$;
