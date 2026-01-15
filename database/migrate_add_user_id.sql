-- ============================================================================
-- MIGRAÇÃO: Adicionar suporte multi-usuário às tabelas existentes
-- ============================================================================
-- Este script adiciona a coluna user_id e configura RLS para modo Supabase
-- Execute no Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR ESTRUTURA ATUAL DAS TABELAS
-- ============================================================================

-- Ver quais tabelas existem
SELECT
  table_name,
  'Existe' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN ('cartoes', 'categorias', 'lancamentos', 'orcamentos', 'envelopes', 'families')
ORDER BY table_name;

-- ============================================================================
-- 2. ADICIONAR COLUNA user_id ÀS TABELAS (se não existir)
-- ============================================================================

DO $$
BEGIN
  -- Adicionar user_id em CARTOES
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'cartoes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'cartoes' AND column_name = 'user_id') THEN
      ALTER TABLE cartoes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE '✅ Coluna user_id adicionada em cartoes';
    ELSE
      RAISE NOTICE 'ℹ️ Coluna user_id já existe em cartoes';
    END IF;
  END IF;

  -- Adicionar user_id em CATEGORIAS
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'categorias') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'categorias' AND column_name = 'user_id') THEN
      ALTER TABLE categorias ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE '✅ Coluna user_id adicionada em categorias';
    ELSE
      RAISE NOTICE 'ℹ️ Coluna user_id já existe em categorias';
    END IF;
  END IF;

  -- Adicionar user_id em LANCAMENTOS
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'lancamentos') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'lancamentos' AND column_name = 'user_id') THEN
      ALTER TABLE lancamentos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE '✅ Coluna user_id adicionada em lancamentos';
    ELSE
      RAISE NOTICE 'ℹ️ Coluna user_id já existe em lancamentos';
    END IF;
  END IF;

  -- Adicionar user_id em ORCAMENTOS
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'orcamentos') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'orcamentos' AND column_name = 'user_id') THEN
      ALTER TABLE orcamentos ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE '✅ Coluna user_id adicionada em orcamentos';
    ELSE
      RAISE NOTICE 'ℹ️ Coluna user_id já existe em orcamentos';
    END IF;
  END IF;

  -- Adicionar user_id em ENVELOPES
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'envelopes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'envelopes' AND column_name = 'user_id') THEN
      ALTER TABLE envelopes ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE '✅ Coluna user_id adicionada em envelopes';
    ELSE
      RAISE NOTICE 'ℹ️ Coluna user_id já existe em envelopes';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. ATUALIZAR DADOS EXISTENTES COM O user_id DO ADMIN
-- ============================================================================

DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Pegar o ID do primeiro usuário admin
  SELECT id INTO admin_user_id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF admin_user_id IS NULL THEN
    -- Se não houver admin, pegar o primeiro usuário
    SELECT id INTO admin_user_id
    FROM users
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF admin_user_id IS NOT NULL THEN
    -- Atualizar cartões sem user_id
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'cartoes') THEN
      UPDATE cartoes SET user_id = admin_user_id WHERE user_id IS NULL;
      RAISE NOTICE '✅ Cartões atualizados com user_id: %', admin_user_id;
    END IF;

    -- Atualizar categorias sem user_id
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'categorias') THEN
      UPDATE categorias SET user_id = admin_user_id WHERE user_id IS NULL;
      RAISE NOTICE '✅ Categorias atualizadas com user_id: %', admin_user_id;
    END IF;

    -- Atualizar lançamentos sem user_id
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'lancamentos') THEN
      UPDATE lancamentos SET user_id = admin_user_id WHERE user_id IS NULL;
      RAISE NOTICE '✅ Lançamentos atualizados com user_id: %', admin_user_id;
    END IF;

    -- Atualizar orçamentos sem user_id
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'orcamentos') THEN
      UPDATE orcamentos SET user_id = admin_user_id WHERE user_id IS NULL;
      RAISE NOTICE '✅ Orçamentos atualizados com user_id: %', admin_user_id;
    END IF;

    -- Atualizar envelopes sem user_id
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'envelopes') THEN
      UPDATE envelopes SET user_id = admin_user_id WHERE user_id IS NULL;
      RAISE NOTICE '✅ Envelopes atualizados com user_id: %', admin_user_id;
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Nenhum usuário encontrado para atualizar os dados';
  END IF;
END $$;

-- ============================================================================
-- 4. HABILITAR RLS E CRIAR POLÍTICAS
-- ============================================================================

-- Habilitar RLS em todas as tabelas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cartoes') THEN
    ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ RLS habilitado em cartoes';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categorias') THEN
    ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ RLS habilitado em categorias';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lancamentos') THEN
    ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ RLS habilitado em lancamentos';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orcamentos') THEN
    ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ RLS habilitado em orcamentos';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'envelopes') THEN
    ALTER TABLE envelopes ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ RLS habilitado em envelopes';
  END IF;
END $$;

-- Criar políticas para CARTÕES
DROP POLICY IF EXISTS "Users can manage own cards" ON cartoes;
CREATE POLICY "Users can manage own cards"
  ON cartoes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Criar políticas para CATEGORIAS
DROP POLICY IF EXISTS "Users can manage own categories" ON categorias;
CREATE POLICY "Users can manage own categories"
  ON categorias FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Criar políticas para LANÇAMENTOS
DROP POLICY IF EXISTS "Users can manage own transactions" ON lancamentos;
CREATE POLICY "Users can manage own transactions"
  ON lancamentos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Criar políticas para ORÇAMENTOS
DROP POLICY IF EXISTS "Users can manage own budgets" ON orcamentos;
CREATE POLICY "Users can manage own budgets"
  ON orcamentos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Criar políticas para ENVELOPES
DROP POLICY IF EXISTS "Users can manage own envelopes" ON envelopes;
CREATE POLICY "Users can manage own envelopes"
  ON envelopes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 5. VERIFICAÇÃO FINAL
-- ============================================================================

-- Verificar políticas criadas
SELECT
  tablename,
  policyname,
  cmd as operations
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('cartoes', 'categorias', 'lancamentos', 'orcamentos', 'envelopes')
ORDER BY tablename;

-- Contar registros por tabela
SELECT
  'cartoes' as tabela,
  COUNT(*) as total_registros,
  COUNT(user_id) as com_user_id
FROM cartoes
UNION ALL
SELECT
  'categorias',
  COUNT(*),
  COUNT(user_id)
FROM categorias
UNION ALL
SELECT
  'lancamentos',
  COUNT(*),
  COUNT(user_id)
FROM lancamentos;

-- ============================================================================
-- FIM
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Migração concluída com sucesso!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📝 O que foi feito:';
  RAISE NOTICE '   ✅ Coluna user_id adicionada em todas as tabelas';
  RAISE NOTICE '   ✅ Dados existentes vinculados ao seu usuário';
  RAISE NOTICE '   ✅ RLS habilitado com políticas de segurança';
  RAISE NOTICE '   ✅ Usuários podem gerenciar apenas seus próprios dados';
  RAISE NOTICE '';
  RAISE NOTICE 'Agora você pode criar cartões, categorias e transações!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
