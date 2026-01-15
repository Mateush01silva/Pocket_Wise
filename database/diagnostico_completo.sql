-- ============================================================================
-- DIAGNÓSTICO COMPLETO DO BANCO DE DADOS
-- ============================================================================
-- Este script mostra a estrutura completa do banco para identificar problemas
-- Execute no Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. LISTAR TODAS AS TABELAS PÚBLICAS
-- ============================================================================

SELECT
  schemaname,
  tablename,
  tableowner,
  CASE
    WHEN rowsecurity THEN '🔒 RLS Habilitado'
    ELSE '🔓 RLS Desabilitado'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 2. ESTRUTURA DETALHADA DE CADA TABELA
-- ============================================================================

-- Ver todas as colunas de todas as tabelas públicas
SELECT
  table_name,
  column_name,
  data_type,
  CASE
    WHEN is_nullable = 'YES' THEN '✅ Nullable'
    ELSE '❌ NOT NULL'
  END as nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- 3. POLÍTICAS RLS EXISTENTES
-- ============================================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operations,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- 4. FOREIGN KEYS (Chaves estrangeiras)
-- ============================================================================

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================================================
-- 5. ÍNDICES
-- ============================================================================

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- 6. TRIGGERS
-- ============================================================================

SELECT
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE tgenabled
    WHEN 'O' THEN '✅ Habilitado'
    WHEN 'D' THEN '❌ Desabilitado'
    ELSE '⚠️ Status: ' || tgenabled
  END as status,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid::regclass::text LIKE 'public.%'
  AND NOT tgisinternal
ORDER BY tgrelid::regclass::text, tgname;

-- ============================================================================
-- 7. CONTAR REGISTROS EM CADA TABELA
-- ============================================================================

-- Contagem de registros (somente para tabelas que existem)
DO $$
DECLARE
  table_record RECORD;
  table_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'CONTAGEM DE REGISTROS POR TABELA';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';

  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I.%I', 'public', table_record.tablename)
    INTO table_count;

    RAISE NOTICE '📊 % : % registros', RPAD(table_record.tablename, 30), table_count;
  END LOOP;

  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ============================================================================
-- 8. VERIFICAR TABELAS ESPERADAS DO POCKET_WISE
-- ============================================================================

SELECT
  table_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND information_schema.tables.table_name = expected_tables.table_name
    )
    THEN '✅ Existe'
    ELSE '❌ Não existe'
  END as status
FROM (VALUES
  ('users'),
  ('assinaturas'),
  ('cartoes'),
  ('categorias'),
  ('lancamentos'),
  ('orcamentos'),
  ('envelopes'),
  ('families')
) AS expected_tables(table_name)
ORDER BY table_name;

-- ============================================================================
-- 9. VERIFICAR SE TABELAS TÊM COLUNA user_id
-- ============================================================================

SELECT
  t.tablename,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = t.tablename
        AND c.column_name = 'user_id'
    )
    THEN '✅ Tem user_id'
    ELSE '❌ Sem user_id'
  END as has_user_id
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename IN ('cartoes', 'categorias', 'lancamentos', 'orcamentos', 'envelopes', 'families')
ORDER BY t.tablename;

-- ============================================================================
-- 10. VERIFICAR USUÁRIOS E ASSINATURAS
-- ============================================================================

-- Usuários cadastrados
SELECT
  email,
  nome,
  role,
  created_at
FROM users
ORDER BY created_at DESC;

-- Assinaturas
SELECT
  u.email,
  a.status,
  a.plan,
  a.trial_ends_at,
  a.current_period_end
FROM assinaturas a
JOIN users u ON u.id = a.user_id
ORDER BY a.created_at DESC;

-- ============================================================================
-- FIM DO DIAGNÓSTICO
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Diagnóstico completo concluído!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Revise os resultados acima para identificar:';
  RAISE NOTICE '   1. Quais tabelas existem';
  RAISE NOTICE '   2. Estrutura de cada tabela (colunas)';
  RAISE NOTICE '   3. Se user_id existe nas tabelas necessárias';
  RAISE NOTICE '   4. Status do RLS em cada tabela';
  RAISE NOTICE '   5. Políticas de segurança configuradas';
  RAISE NOTICE '';
  RAISE NOTICE 'Copie TODOS os resultados e envie para análise!';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
