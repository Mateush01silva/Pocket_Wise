-- ============================================================================
-- DIAGNÓSTICO E CORREÇÃO DE PERMISSÕES (RLS)
-- ============================================================================
-- Este script verifica e corrige as políticas RLS para permitir que usuários
-- autenticados possam criar, ler, atualizar e deletar seus próprios dados
-- ============================================================================

-- ============================================================================
-- 1. VERIFICAR TABELAS E RLS ATUAL
-- ============================================================================

-- Ver todas as tabelas públicas e seu status de RLS
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Ver políticas existentes
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- 2. VERIFICAR SE AS TABELAS PRINCIPAIS EXISTEM
-- ============================================================================

SELECT
  table_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name)
    THEN '✅ Existe'
    ELSE '❌ Não existe'
  END as status
FROM (VALUES
  ('cartoes'),
  ('categorias'),
  ('lancamentos'),
  ('orcamentos'),
  ('envelopes'),
  ('families')
) AS t(table_name);

-- ============================================================================
-- 3. HABILITAR RLS EM TODAS AS TABELAS PRINCIPAIS
-- ============================================================================

-- Habilitar RLS (se as tabelas existirem)
DO $$
BEGIN
  -- Cartões
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cartoes') THEN
    EXECUTE 'ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE '✅ RLS habilitado em cartoes';
  END IF;

  -- Categorias
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categorias') THEN
    EXECUTE 'ALTER TABLE categorias ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE '✅ RLS habilitado em categorias';
  END IF;

  -- Lançamentos (transações)
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lancamentos') THEN
    EXECUTE 'ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE '✅ RLS habilitado em lancamentos';
  END IF;

  -- Orçamentos
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orcamentos') THEN
    EXECUTE 'ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE '✅ RLS habilitado em orcamentos';
  END IF;

  -- Envelopes
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'envelopes') THEN
    EXECUTE 'ALTER TABLE envelopes ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE '✅ RLS habilitado em envelopes';
  END IF;

  -- Families
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'families') THEN
    EXECUTE 'ALTER TABLE families ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE '✅ RLS habilitado em families';
  END IF;
END $$;

-- ============================================================================
-- 4. CRIAR POLÍTICAS PERMISSIVAS PARA USUÁRIOS AUTENTICADOS
-- ============================================================================

-- CARTÕES: Usuários podem fazer tudo com seus próprios cartões
DROP POLICY IF EXISTS "Users can manage own cards" ON cartoes;
CREATE POLICY "Users can manage own cards"
  ON cartoes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- CATEGORIAS: Usuários podem fazer tudo com suas próprias categorias
DROP POLICY IF EXISTS "Users can manage own categories" ON categorias;
CREATE POLICY "Users can manage own categories"
  ON categorias FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- LANÇAMENTOS: Usuários podem fazer tudo com seus próprios lançamentos
DROP POLICY IF EXISTS "Users can manage own transactions" ON lancamentos;
CREATE POLICY "Users can manage own transactions"
  ON lancamentos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ORÇAMENTOS: Usuários podem fazer tudo com seus próprios orçamentos
DROP POLICY IF EXISTS "Users can manage own budgets" ON orcamentos;
CREATE POLICY "Users can manage own budgets"
  ON orcamentos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ENVELOPES: Usuários podem fazer tudo com seus próprios envelopes
DROP POLICY IF EXISTS "Users can manage own envelopes" ON envelopes;
CREATE POLICY "Users can manage own envelopes"
  ON envelopes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- FAMILIES: Usuários podem ver e gerenciar suas próprias famílias
DROP POLICY IF EXISTS "Users can manage own family" ON families;
CREATE POLICY "Users can manage own family"
  ON families FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

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
  AND tablename IN ('cartoes', 'categorias', 'lancamentos', 'orcamentos', 'envelopes', 'families')
ORDER BY tablename;

-- ============================================================================
-- FIM
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Permissões RLS configuradas com sucesso!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Usuários autenticados agora podem:';
  RAISE NOTICE '   ✅ Criar, ler, atualizar e deletar seus próprios cartões';
  RAISE NOTICE '   ✅ Criar, ler, atualizar e deletar suas próprias categorias';
  RAISE NOTICE '   ✅ Criar, ler, atualizar e deletar suas próprias transações';
  RAISE NOTICE '   ✅ Gerenciar orçamentos e envelopes';
  RAISE NOTICE '';
  RAISE NOTICE 'Recarregue a aplicação e teste novamente!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
